// Records the JSON-RPC answers and registration files of real agents into fixtures/, so tests run offline.
//   node scripts/record.mjs base:1 base-sepolia:2 ...
import { writeFileSync } from "node:fs";
import { loadAgent, createRpc, createFetchJson } from "../viewer.js";
import { RPC_URLS } from "../config.js";

for (const arg of process.argv.slice(2)) {
  const [network, agentId] = arg.split(":");
  const calls = {}, files = {};
  const live = createRpc(RPC_URLS[network]);
  const rpc = async (method, params) => {
    const key = `${method} ${params[0].to.toLowerCase()} ${params[0].data}`;
    try { const r = await live(method, params); calls[key] = { result: r }; return r; }
    catch (e) { calls[key] = { error: { code: e.code, message: e.message } }; throw e; }
  };
  const fj = createFetchJson();
  const fetchJson = async (url) => { const j = await fj(url); files[url] = j; return j; };
  const r = await loadAgent({ agentId, network, rpc, fetchJson });
  const out = { network, agentId, recorded_at: new Date().toISOString(), calls, files, expected: { status: r.status, owner: r.owner, tokenURI: r.tokenURI, name: r.registration?.name ?? null, feedback_count: r.feedback?.count ?? null, average: r.feedback?.average ?? null } };
  writeFileSync(`fixtures/${network}-${agentId}.json`, JSON.stringify(out, null, 1) + "\n");
  console.log(arg, r.status, r.error ?? "", r.registration?.name ?? "", r.feedback?.count);
}
