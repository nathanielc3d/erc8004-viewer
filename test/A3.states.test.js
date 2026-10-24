import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAgent } from "../viewer.js";
import { fixture, fixtureRpc, fixtureFetchJson, encodeAddress, encodeString } from "./helpers.js";

test("A3 an agent that does not exist gives the empty state (ownerOf reverts, recorded on Base Sepolia)", async () => {
  const fx = fixture("base-sepolia-999999999");
  const r = await loadAgent({ agentId: 999999999, network: "base-sepolia", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx) });
  assert.equal(r.status, "empty");
  assert.equal(r.owner, null);
  assert.match(r.message, /No agent with id 999999999/);
});

test("A3 a revert given only as a message, and the zero address, are empty too", async () => {
  const revert = async () => { throw new Error("execution reverted: ERC721NonexistentToken"); };
  assert.equal((await loadAgent({ agentId: 4, network: "base", rpc: revert })).status, "empty");
  const zero = async () => encodeAddress("0x0");
  assert.equal((await loadAgent({ agentId: 4, network: "base", rpc: zero })).status, "empty");
});

test("A3 an RPC failure gives the error state with a plain message", async () => {
  const down = async () => { throw Object.assign(new Error("fetch failed"), { code: -32603 }); };
  const r = await loadAgent({ agentId: 1, network: "base", rpc: down });
  assert.equal(r.status, "error");
  assert.match(r.error, /RPC call failed: fetch failed/);
  const limited = async () => { throw Object.assign(new Error("rate limited"), { code: 429 }); };
  assert.equal((await loadAgent({ agentId: 1, network: "base", rpc: limited })).status, "error");
});

test("A3 a registration file that fails gives the error state, keeping the owner", async () => {
  const rpc = async (_m, [{ data }]) => data.startsWith("0x6352211e") ? encodeAddress("0x2222222222222222222222222222222222222222") : encodeString("https://agent.test/reg.json");
  const r404 = await loadAgent({ agentId: 2, network: "base", reputationRegistry: null, rpc, fetchJson: async () => { throw new Error("HTTP 404"); } });
  assert.equal(r404.status, "error");
  assert.match(r404.error, /registration file could not be read: HTTP 404/);
  assert.equal(r404.owner, "0x2222222222222222222222222222222222222222");
  const notObject = await loadAgent({ agentId: 2, network: "base", reputationRegistry: null, rpc, fetchJson: async () => [1, 2] });
  assert.equal(notObject.status, "error");
  const badData = await loadAgent({ agentId: 2, network: "base", reputationRegistry: null, rpc: async (_m, [{ data }]) => data.startsWith("0x6352211e") ? encodeAddress("0x2") : encodeString("data:application/json;base64,!!!") });
  assert.equal(badData.status, "error");
});

test("A3 nothing throws: bad ids, garbage answers, missing arguments", async () => {
  const cases = [
    {}, { agentId: -1 }, { agentId: "abc" }, { agentId: 1.5 }, { agentId: 1, network: "mars" },
    { agentId: 1, network: "base", rpc: async () => "0xzz" },
    { agentId: 1, network: "base", rpc: async () => "0x" },
    { agentId: 1, network: "base", rpc: async () => null },
    { agentId: 1, network: "base", rpc: () => { throw new TypeError("sync boom"); } },
    { agentId: 1, network: "base", rpc: async (_m, [{ data }]) => data.startsWith("0x6352211e") ? encodeAddress("0x3") : "0x1234" },
  ];
  for (const c of cases) {
    const r = await loadAgent(c);
    assert.ok(["error", "empty"].includes(r.status), JSON.stringify(c));
    if (r.status === "error") assert.equal(typeof r.error, "string");
  }
  assert.equal((await loadAgent()).status, "error");
});
