// ERC-8004 identity and reputation reader. No dependencies: runs in the browser and in Node 20.
// Built by an AI agent (Money Machine, operated by Nathaniel). MIT licence.
import { REGISTRIES, RPC_URLS, IPFS_GATEWAY, IPFS_GATEWAYS } from "./config.js";

export { REGISTRIES, RPC_URLS };

const SEL = {
  ownerOf: "6352211e", // ownerOf(uint256)
  tokenURI: "c87b56dd", // tokenURI(uint256)
  readAllFeedback: "d9d84224", // readAllFeedback(uint256,address[],string,string,bool)
};
const ZERO = "0x0000000000000000000000000000000000000000";

// ---------- ABI helpers (only what the two registries need) ----------
const word = (n) => BigInt(n).toString(16).padStart(64, "0");

export function encodeCall(name, agentId) {
  if (name === "readAllFeedback") {
    // agentId, offset of address[] (5 words of head), offset of tag1, offset of tag2, includeRevoked=false
    // tail: address[] length 0, tag1 length 0, tag2 length 0
    return "0x" + SEL.readAllFeedback + word(agentId) + word(160) + word(192) + word(224) + word(0) + word(0) + word(0) + word(0);
  }
  return "0x" + SEL[name] + word(agentId);
}

function hexToBytes(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 || /[^0-9a-fA-F]/.test(h)) throw new Error("not hex data");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

class Reader {
  constructor(hex) { this.h = (hex.startsWith("0x") ? hex.slice(2) : hex).toLowerCase(); }
  word(i) {
    const w = this.h.slice(i * 64, i * 64 + 64);
    if (w.length !== 64) throw new Error("short ABI data");
    return w;
  }
  uint(i) { return BigInt("0x" + this.word(i)); }
  int(i) { const v = this.uint(i); return v >= 1n << 255n ? v - (1n << 256n) : v; }
  address(i) { return "0x" + this.word(i).slice(24); }
  bool(i) { return this.uint(i) !== 0n; }
  // dynamic values: `at` is a byte offset to the start of the value
  num(byteOff) { if (byteOff % 32n) throw new Error("bad ABI offset"); return Number(byteOff / 32n); }
  stringAt(w) {
    const len = Number(this.uint(w));
    const hex = this.h.slice((w + 1) * 64, (w + 1) * 64 + len * 2);
    if (hex.length !== len * 2) throw new Error("short ABI string");
    return new TextDecoder().decode(hexToBytes(hex));
  }
}

export function decodeAddress(hex) { return toChecksumless(new Reader(hex).address(0)); }
export function decodeString(hex) { const r = new Reader(hex); return r.stringAt(r.num(r.uint(0))); }

export function decodeFeedback(hex) {
  const r = new Reader(hex);
  const arr = (k, read) => {
    const base = r.num(r.uint(k));
    const n = Number(r.uint(base));
    return Array.from({ length: n }, (_, i) => read(base + 1 + i, base + 1));
  };
  const clients = arr(0, (w) => r.address(w));
  const indexes = arr(1, (w) => r.uint(w));
  const values = arr(2, (w) => r.int(w));
  const decimals = arr(3, (w) => Number(r.uint(w)));
  const strings = (k) => arr(k, (w, start) => r.stringAt(start + r.num(r.uint(w))));
  const tag1 = strings(4), tag2 = strings(5);
  const revoked = arr(6, (w) => r.bool(w));
  return clients.map((c, i) => ({ client: c, index: indexes[i], value: values[i], decimals: decimals[i], tag1: tag1[i], tag2: tag2[i], revoked: revoked[i] }));
}

const toChecksumless = (a) => a.toLowerCase();

// ---------- values ----------
export function scoreOf(value, decimals) {
  // exact decimal text of value / 10^decimals, then a Number for display and averages
  const neg = value < 0n;
  const digits = (neg ? -value : value).toString().padStart(decimals + 1, "0");
  const text = decimals ? digits.slice(0, -decimals) + "." + digits.slice(-decimals) : digits;
  return Number((neg ? "-" : "") + text);
}

export function summarizeFeedback(entries, latest = 10) {
  const live = entries.filter((e) => !e.revoked);
  const items = live.map((e) => ({ client: e.client, score: scoreOf(e.value, e.decimals), tags: [e.tag1, e.tag2].filter(Boolean), index: Number(e.index) }));
  const count = items.length;
  const average = count ? Math.round((items.reduce((s, x) => s + x.score, 0) / count) * 100) / 100 : null;
  // the registry returns entries grouped by client in order of first feedback; the newest client comes last
  return { count, average, items: items.slice(-latest).reverse() };
}

// ---------- URIs ----------
export function resolveUri(uri, gateway = IPFS_GATEWAY) {
  const u = String(uri).trim();
  if (u.startsWith("ipfs://")) return gateway + u.slice(7).replace(/^ipfs\//, "");
  if (u.startsWith("ar://")) return "https://arweave.net/" + u.slice(5);
  return u;
}

export function decodeDataUri(uri) {
  const m = /^data:([^,]*?),(.*)$/s.exec(uri);
  if (!m) throw new Error("not a data: URI");
  const meta = m[1].split(";").map((s) => s.trim().toLowerCase());
  if (meta[0] && meta[0] !== "application/json" && meta[0] !== "text/plain") throw new Error(`data: URI of type ${meta[0]}, expected application/json`);
  let text;
  if (meta.includes("base64")) {
    const bin = atob(m[2].replace(/\s/g, ""));
    text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } else {
    text = decodeURIComponent(m[2]);
  }
  return JSON.parse(text);
}

// ---------- default transports ----------
export function createRpc(url, fetchImpl = globalThis.fetch) {
  let id = 0;
  return async function rpc(method, params) {
    const res = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    let body;
    try { body = await res.json(); } catch { throw Object.assign(new Error(`RPC answered HTTP ${res.status} without JSON`), { code: res.status }); }
    if (body.error) throw Object.assign(new Error(body.error.message || "RPC error"), { code: body.error.code, data: body.error.data });
    if (!res.ok) throw Object.assign(new Error(`RPC answered HTTP ${res.status}`), { code: res.status });
    return body.result;
  };
}

export function createFetchJson(fetchImpl = globalThis.fetch, gateways = IPFS_GATEWAYS) {
  return async function fetchJson(url) {
    const u = String(url);
    if (u.startsWith("data:")) return decodeDataUri(u);
    // an ipfs:// URI or a URL on the first gateway is tried on every gateway in turn
    const cid = u.startsWith("ipfs://") ? u.slice(7).replace(/^ipfs\//, "") : u.startsWith(gateways[0]) ? u.slice(gateways[0].length) : null;
    const urls = cid ? gateways.map((g) => g + cid) : [u];
    let last;
    for (const target of urls) {
      try {
        const res = await fetchImpl(target, { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        try { return JSON.parse(text); } catch { throw new Error("the file is not valid JSON"); }
      } catch (e) { last = e; }
    }
    throw last;
  };
}

// ---------- registration ----------
export function normalizeRegistration(reg) {
  if (!reg || typeof reg !== "object" || Array.isArray(reg)) throw new Error("the registration file is not a JSON object");
  const list = Array.isArray(reg.services) ? reg.services : Array.isArray(reg.endpoints) ? reg.endpoints : [];
  return {
    name: typeof reg.name === "string" ? reg.name : null,
    description: typeof reg.description === "string" ? reg.description : null,
    image: typeof reg.image === "string" ? reg.image : null,
    endpoints: list.filter((e) => e && typeof e === "object").map((e) => ({ name: String(e.name ?? e.type ?? "endpoint"), endpoint: String(e.endpoint ?? e.url ?? ""), version: e.version == null ? null : String(e.version) })),
    supportedTrust: Array.isArray(reg.supportedTrust) ? reg.supportedTrust.map(String) : [],
    x402Support: reg.x402Support ?? reg.x402support ?? null,
    active: reg.active ?? null,
  };
}

const isRevert = (e) => e && (e.code === 3 || /revert/i.test(String(e.message)));
const plain = (e) => String((e && e.message) || e).slice(0, 200);

// ---------- main entry ----------
export async function loadAgent({ agentId, network = "base", identityRegistry, reputationRegistry, rpc, fetchJson } = {}) {
  const out = { status: "error", agentId: agentId == null ? null : String(agentId), owner: null, tokenURI: null, registration: null, feedback: null };
  try {
    let id;
    try { id = BigInt(String(agentId).trim()); } catch { id = -1n; }
    if (agentId == null || String(agentId).trim() === "" || id < 0n || id >= 1n << 256n) return { ...out, error: "The agent id must be a whole number, 0 or more." };
    out.agentId = id.toString();
    const reg = REGISTRIES[network];
    identityRegistry ??= reg?.identity;
    if (reputationRegistry === undefined) reputationRegistry = reg?.reputation;
    if (!identityRegistry) return { ...out, error: `Unknown network "${network}" and no identity registry given.` };
    if (typeof rpc === "string") rpc = createRpc(rpc);
    rpc ??= RPC_URLS[network] && createRpc(RPC_URLS[network]);
    if (typeof rpc !== "function") return { ...out, error: "No RPC given for this network." };
    fetchJson ??= createFetchJson();
    const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);

    // 1. owner
    let ownerHex;
    try { ownerHex = await call(identityRegistry, encodeCall("ownerOf", id)); }
    catch (e) {
      if (isRevert(e)) return { ...out, status: "empty", message: `No agent with id ${id} on ${network}.` };
      return { ...out, error: `The RPC call failed: ${plain(e)}` };
    }
    if (!ownerHex || ownerHex === "0x") return { ...out, error: "The identity registry returned no data: is it deployed on this network?" };
    const owner = decodeAddress(ownerHex);
    if (owner === ZERO) return { ...out, status: "empty", message: `No agent with id ${id} on ${network}.` };
    out.owner = owner;

    // 2. tokenURI and the registration file
    try { out.tokenURI = decodeString(await call(identityRegistry, encodeCall("tokenURI", id))); }
    catch (e) {
      if (isRevert(e)) return { ...out, status: "empty", message: `No agent with id ${id} on ${network}.` };
      return { ...out, error: `Reading the tokenURI failed: ${plain(e)}` };
    }
    let failure = null;
    if (out.tokenURI) {
      try {
        const raw = out.tokenURI.startsWith("data:") ? decodeDataUri(out.tokenURI) : await fetchJson(resolveUri(out.tokenURI));
        out.registration = normalizeRegistration(raw);
      } catch (e) { failure = `The registration file could not be read: ${plain(e)}`; }
    }

    // 3. reputation (read even when the file failed, so the page can still show it)
    if (reputationRegistry) {
      try { out.feedback = summarizeFeedback(decodeFeedback(await call(reputationRegistry, encodeCall("readAllFeedback", id)))); }
      catch (e) { failure ??= `Reading the reputation failed: ${plain(e)}`; }
    }
    if (failure) return { ...out, status: "error", error: failure };
    return { ...out, status: "ok" };
  } catch (e) {
    return { ...out, status: "error", error: `Unexpected problem: ${plain(e)}` };
  }
}
