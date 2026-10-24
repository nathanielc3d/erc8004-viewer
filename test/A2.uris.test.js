import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAgent, decodeDataUri, resolveUri, createFetchJson } from "../viewer.js";
import { fixture, fixtureRpc, fixtureFetchJson, encodeAddress, encodeString } from "./helpers.js";
import { REGISTRIES } from "../config.js";

const OWNER = "0x1111111111111111111111111111111111111111";
const rpcFor = (uri) => async (_m, [{ data }]) => data.startsWith("0x6352211e") ? encodeAddress(OWNER) : encodeString(uri);

test("A2 a base64 data:application/json tokenURI is decoded without a request (Base agent 1, recorded)", async () => {
  const fx = fixture("base-1");
  const seen = [];
  const r = await loadAgent({ agentId: 1, network: "base", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx, seen) });
  assert.match(r.tokenURI, /^data:application\/json;base64,/);
  assert.equal(r.registration.name, "ClawNews");
  assert.deepEqual(seen, []);
});

test("A2 a plain (not base64) data: URI with UTF-8 and percent escapes is decoded without a request", async () => {
  const uri = "data:application/json," + encodeURIComponent(JSON.stringify({ name: "Agent é", description: "a,b" }));
  const seen = [];
  const r = await loadAgent({ agentId: 7, network: "base", reputationRegistry: null, rpc: rpcFor(uri), fetchJson: async (u) => { seen.push(u); throw new Error("no request expected"); } });
  assert.equal(r.status, "ok");
  assert.equal(r.registration.name, "Agent é");
  assert.equal(r.registration.description, "a,b");
  assert.deepEqual(seen, []);
  assert.equal(decodeDataUri("data:application/json;charset=utf-8;base64," + Buffer.from('{"name":"ü"}').toString("base64")).name, "ü");
});

test("A2 an ipfs:// tokenURI is fetched through an https gateway (Base Sepolia agent 2, recorded)", async () => {
  const fx = fixture("base-sepolia-2");
  const seen = [];
  const r = await loadAgent({ agentId: 2, network: "base-sepolia", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx, seen) });
  assert.match(r.tokenURI, /^ipfs:\/\//);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^https:\/\/[^/]+\/ipfs\/bafkrei/);
  assert.equal(r.status, "ok");
  assert.equal(r.registration.name, "UniMaker Agent");
});

test("A2 the default fetchJson maps ipfs:// to a gateway and falls back to the next gateway on failure", async () => {
  const asked = [];
  const fake = async (url) => { asked.push(url); return asked.length === 1 ? new Response("rate limited", { status: 429 }) : new Response('{"name":"x"}'); };
  const fj = createFetchJson(fake, ["https://g1.test/ipfs/", "https://g2.test/ipfs/"]);
  assert.deepEqual(await fj("ipfs://bafyCID/reg.json"), { name: "x" });
  assert.deepEqual(asked, ["https://g1.test/ipfs/bafyCID/reg.json", "https://g2.test/ipfs/bafyCID/reg.json"]);
  assert.equal(resolveUri("ipfs://ipfs/bafyCID", "https://g/ipfs/"), "https://g/ipfs/bafyCID");
  assert.deepEqual(await createFetchJson(async () => { throw new Error("no request"); })("data:application/json,%7B%22a%22%3A1%7D"), { a: 1 });
  assert.ok(REGISTRIES.base.identity);
});
