import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAgent } from "../viewer.js";
import { REGISTRIES, RPC_URLS, KOGNAI_TEST_IDENTITY } from "../config.js";
import { fixture, fixtureRpc, fixtureFetchJson } from "./helpers.js";

test("A5 config names the ERC-8004 deployments on Base and Base Sepolia", () => {
  assert.deepEqual(Object.keys(REGISTRIES).sort(), ["base", "base-sepolia"]);
  for (const n of ["base", "base-sepolia"]) {
    assert.match(REGISTRIES[n].identity, /^0x8004[0-9a-fA-F]{36}$/);
    assert.match(REGISTRIES[n].reputation, /^0x8004[0-9a-fA-F]{36}$/);
    assert.match(RPC_URLS[n], /^https:\/\//);
  }
  assert.notEqual(REGISTRIES.base.identity, REGISTRIES["base-sepolia"].identity);
});

test("A5 the right registry is called on each network (recorded on both)", async () => {
  for (const [network, name] of [["base", "base-1"], ["base-sepolia", "base-sepolia-1"]]) {
    const fx = fixture(name), log = [];
    const r = await loadAgent({ agentId: 1, network, rpc: fixtureRpc(fx, log), fetchJson: fixtureFetchJson(fx) });
    assert.equal(r.status, "ok", network);
    assert.ok(log[0].includes(REGISTRIES[network].identity.toLowerCase()));
  }
});

// Kognai has not published its Sepolia test identity id yet (24 Oct 2026). When it does, set
// KOGNAI_TEST_IDENTITY.agentId in config.js and record it: node scripts/record.mjs base-sepolia:<id>
test("A5 reads the Base Sepolia test identity Kognai publishes", { todo: KOGNAI_TEST_IDENTITY.agentId == null ? "waiting for Kognai's test identity id" : false }, async () => {
  const id = KOGNAI_TEST_IDENTITY.agentId;
  const fx = fixture(`base-sepolia-${id}`);
  const r = await loadAgent({ agentId: id, network: "base-sepolia", rpc: fixtureRpc(fx), fetchJson: fixtureFetchJson(fx) });
  assert.equal(r.status, "ok");
});

test("A5 live check on both networks (VIEWER_LIVE=1)", { skip: !process.env.VIEWER_LIVE }, async () => {
  for (const network of ["base", "base-sepolia"]) {
    const r = await loadAgent({ agentId: 1, network });
    assert.ok(r.owner, `${network}: ${r.error}`);
  }
});
