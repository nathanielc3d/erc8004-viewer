import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAgent } from "../viewer.js";
import { fixture, fixtureRpc, fixtureFetchJson } from "./helpers.js";

test("A1 an existing agent shows its owner, its tokenURI and its registration file (Base agent 1, recorded)", async () => {
  const fx = fixture("base-1");
  const r = await loadAgent({ agentId: 1, network: "base", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx) });
  assert.equal(r.status, "ok");
  assert.equal(r.agentId, "1");
  assert.equal(r.owner, fx.expected.owner);
  assert.match(r.owner, /^0x[0-9a-f]{40}$/);
  assert.equal(r.tokenURI, fx.expected.tokenURI);
  assert.equal(r.registration.name, "ClawNews");
  assert.ok(Array.isArray(r.registration.endpoints));
  assert.equal(r.error, undefined);
});

test("A1 an https tokenURI is fetched and its file shown (Base agent 3, recorded)", async () => {
  const fx = fixture("base-3");
  const seen = [];
  const r = await loadAgent({ agentId: "3", network: "base", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx, seen) });
  assert.equal(r.status, "ok");
  assert.match(r.tokenURI, /^https:\/\//);
  assert.deepEqual(seen, [r.tokenURI]);
  assert.equal(r.registration.name, fx.expected.name);
});

test("A1 the registration shows name, description, image, endpoints and supported trust", async () => {
  const fx = fixture("base-sepolia-1");
  const r = await loadAgent({ agentId: 1, network: "base-sepolia", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx) });
  assert.equal(r.status, "ok");
  assert.equal(r.registration.name, "Test Agent 004 (Image Test)");
  assert.match(r.registration.description, /8004scan/);
  assert.match(r.registration.image, /^https:\/\//);
  assert.deepEqual(r.registration.endpoints.map((e) => e.name), ["web", "x402"]);
  assert.equal(r.registration.endpoints[1].version, "2.0");
  assert.deepEqual(r.registration.supportedTrust, ["reputation"]);
});

test("A1 an agent with an empty tokenURI still shows its owner", async () => {
  const fx = fixture("base-sepolia-5");
  const r = await loadAgent({ agentId: 5, network: "base-sepolia", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx) });
  assert.equal(r.status, "ok");
  assert.equal(r.tokenURI, "");
  assert.equal(r.registration, null);
  assert.equal(r.owner, fx.expected.owner);
});
