import { readFileSync } from "node:fs";

export const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));

// rpc that answers from a recorded fixture, like a JSON-RPC client would (errors carry code and message)
export function fixtureRpc(fx, log = []) {
  return async (method, params) => {
    const key = `${method} ${params[0].to.toLowerCase()} ${params[0].data}`;
    log.push(key);
    const hit = fx.calls[key];
    if (!hit) throw Object.assign(new Error(`not in fixture: ${key}`), { code: -32000 });
    if (hit.error) throw Object.assign(new Error(hit.error.message), { code: hit.error.code });
    return hit.result;
  };
}

export function fixtureFetchJson(fx, log = []) {
  return async (url) => {
    log.push(url);
    if (!(url in fx.files)) throw new Error("HTTP 404");
    return fx.files[url];
  };
}

// minimal ABI encoder for readAllFeedback answers, to build synthetic cases
const w = (n) => (BigInt.asUintN(256, BigInt(n))).toString(16).padStart(64, "0");
const strWords = (s) => { const hex = Buffer.from(s, "utf8").toString("hex"); const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, "0"); return w(hex.length / 2) + padded; };
export function encodeFeedback(entries) {
  const staticArr = (vals) => w(vals.length) + vals.map(w).join("");
  const strArr = (vals) => {
    const bodies = vals.map(strWords);
    let off = vals.length * 32, heads = "";
    for (const b of bodies) { heads += w(off); off += b.length / 2; }
    return w(vals.length) + heads + bodies.join("");
  };
  const parts = [
    staticArr(entries.map((e) => BigInt(e.client))),
    staticArr(entries.map((e, i) => e.index ?? i + 1)),
    staticArr(entries.map((e) => e.value)),
    staticArr(entries.map((e) => e.decimals ?? 0)),
    strArr(entries.map((e) => e.tag1 ?? "")),
    strArr(entries.map((e) => e.tag2 ?? "")),
    staticArr(entries.map((e) => (e.revoked ? 1 : 0))),
  ];
  let off = 7 * 32, head = "";
  for (const p of parts) { head += w(off); off += p.length / 2; }
  return "0x" + head + parts.join("");
}
export const encodeAddress = (a) => "0x" + w(BigInt(a));
export const encodeString = (s) => "0x" + w(32) + strWords(s);
