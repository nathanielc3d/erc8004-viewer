import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAgent, decodeFeedback, summarizeFeedback, encodeCall } from "../viewer.js";
import { REGISTRIES } from "../config.js";
import { fixture, fixtureRpc, fixtureFetchJson, encodeAddress, encodeString, encodeFeedback } from "./helpers.js";

test("A4 reputation entries are read and summarised (Base agent 1, recorded: 47 entries)", async () => {
  const fx = fixture("base-1");
  const log = [];
  const r = await loadAgent({ agentId: 1, network: "base", rpc: fixtureRpc(fx, log), fetchJson: fixtureFetchJson(fx) });
  assert.equal(r.feedback.count, 47);
  assert.equal(r.feedback.average, fx.expected.average);
  assert.ok(r.feedback.items.length > 0 && r.feedback.items.length <= 10);
  for (const i of r.feedback.items) { assert.match(i.client, /^0x[0-9a-f]{40}$/); assert.equal(typeof i.score, "number"); assert.ok(Array.isArray(i.tags)); }
  assert.ok(log.some((k) => k.includes(REGISTRIES.base.reputation.toLowerCase()) && k.endsWith(encodeCall("readAllFeedback", 1n))));
});

test("A4 an agent without feedback says so (count 0, average null)", async () => {
  const fx = fixture("base-sepolia-5");
  const r = await loadAgent({ agentId: 5, network: "base-sepolia", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx) });
  assert.deepEqual(r.feedback, { count: 0, average: null, items: [] });
});

test("A4 decimals, negative values, tags and revoked entries", () => {
  const hex = encodeFeedback([
    { client: "0xaa", value: 9500, decimals: 2, tag1: "quality", tag2: "" },
    { client: "0xaa", value: -20, decimals: 0, tag1: "", tag2: "speed" },
    { client: "0xbb", value: 100, decimals: 0, tag1: "x", tag2: "y", revoked: true },
    { client: "0xcc", value: 75, decimals: 0, tag1: "uptime", tag2: "30d" },
  ]);
  const entries = decodeFeedback(hex);
  assert.equal(entries.length, 4);
  assert.equal(entries[1].value, -20n);
  const s = summarizeFeedback(entries);
  assert.equal(s.count, 3);
  assert.equal(s.average, 50);
  assert.deepEqual(s.items[0], { client: "0x00000000000000000000000000000000000000cc", score: 75, tags: ["uptime", "30d"], index: 4 });
  assert.deepEqual(s.items.map((i) => i.score), [75, -20, 95]);
});

test("A4 no reputation registry: feedback is null; a reputation read failure is an error state", async () => {
  const rpc = async (_m, [{ to, data }]) => {
    if (to === REGISTRIES.base.reputation) throw new Error("upstream timeout");
    return data.startsWith("0x6352211e") ? encodeAddress("0x4") : encodeString("");
  };
  assert.equal((await loadAgent({ agentId: 9, network: "base", reputationRegistry: null, rpc })).feedback, null);
  const r = await loadAgent({ agentId: 9, network: "base", rpc });
  assert.equal(r.status, "error");
  assert.match(r.error, /reputation failed: upstream timeout/);
});
