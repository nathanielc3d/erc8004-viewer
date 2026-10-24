# erc8004-viewer

A static page that shows an AI agent's [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) on chain identity (owner, tokenURI, registration file) and its reputation feedback, on Base and Base Sepolia. No backend, no dependencies: the browser calls a public JSON-RPC endpoint directly.

> **AI disclosure.** Code, tests, fixtures and docs were written by an autonomous AI agent ("Money Machine") run by Nathaniel, for the Kognessium job "ERC-8004 identity viewer". The operator is responsible for it.

- Live page: https://erc8004-viewer.moneymachine.workers.dev/?network=base&agentId=1
- Same files work from any static host or `npx serve .` (open `index.html` through http, ES modules do not load from `file://`).

## Registries

`config.js` exports `REGISTRIES`, the reference ERC-8004 deployments published by the ERC-8004 authors in [erc-8004/erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts) (README, sections "Base Mainnet" and "Base Sepolia"):

| Network | IdentityRegistry | ReputationRegistry |
|---|---|---|
| `base` (8453) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| `base-sepolia` (84532) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Default RPCs: `https://mainnet.base.org` and `https://sepolia.base.org` (free, public). Any RPC can be typed in the page or passed to `loadAgent`.

## API (`viewer.js`, browser and Node 20)

```js
import { loadAgent, createRpc, createFetchJson } from "./viewer.js";
import { REGISTRIES } from "./config.js";

const r = await loadAgent({
  agentId: 1,
  network: "base",
  identityRegistry: REGISTRIES.base.identity,      // optional, defaults from config.js
  reputationRegistry: REGISTRIES.base.reputation,  // optional, null to skip reputation
  rpc: createRpc("https://mainnet.base.org"),     // (method, params) => Promise<result>
  fetchJson: createFetchJson(),                    // (url) => Promise<object>
});
// { status: "ok" | "empty" | "error", agentId, owner, tokenURI, registration, feedback, error?, message? }
```

- `rpc(method, params)` sends one JSON-RPC call (`eth_call`); `createRpc` throws an Error carrying the JSON-RPC `code` and `message` when the call fails.
- Identity: `ownerOf(uint256)` then `tokenURI(uint256)` on the ERC-721 identity registry.
- `status` is `empty` when `ownerOf` reverts (code 3, or a message containing "revert") or returns the zero address; `error` when the RPC or the registration file fails, with a plain `error` message (what was read before the failure is kept, so the page can show it); `ok` otherwise. `loadAgent` never throws.
- tokenURI: `data:application/json` (base64 or percent encoded) is decoded in place, with no request and `fetchJson` is not called; `ipfs://` is mapped to an https gateway (`https://ipfs.io/ipfs/`) before `fetchJson` is called; https URLs are fetched as they are. The default `createFetchJson` retries `ipfs://` and gateway URLs on `dweb.link` and `gateway.pinata.cloud` when a gateway fails or rate limits. An empty tokenURI is shown as "no registration file".
- `registration` is normalised to `{name, description, image, endpoints: [{name, endpoint, version}], supportedTrust, x402Support, active}` (reads `services` from the current spec, or `endpoints` from older files).
- `feedback` is `{count, average, items: [{client, score, tags, index}]}`, from one `readAllFeedback(agentId, [], "", "", false)` call (revoked entries left out). `score` is `value / 10^valueDecimals`; `average` is the mean score rounded to 2 decimals, `null` when there is no feedback. `items` holds the latest 10, newest first (the registry returns entries grouped by client, in order of each client's first feedback).

## Page

`index.html` + `app.js` + `style.css`: agent id, network (Base or Base Sepolia) and an optional RPC; shows name, description, image, endpoints, supported trust, owner (explorer link), tokenURI, then the reputation as count, average and the latest entries, or a clear empty or error state. Deep links: `?network=base-sepolia&agentId=1`. Mobile first (viewport meta, single column at 360 px), light and dark from the system setting with a manual switch. Everything is rendered as text nodes (no HTML from the registration file is ever injected); only http and https links are made clickable.

## Tests

`npm test` (node:test, no network, 25 tests). Fixtures in `fixtures/` are real answers recorded from Base and Base Sepolia on 24 Oct 2026 with `node scripts/record.mjs base:1 base:3 base-sepolia:1 base-sepolia:2 base-sepolia:5 base-sepolia:999999999`. `VIEWER_LIVE=1 npm test` also reads agent 1 on both networks over the network.

| Item | Test | Status |
|---|---|---|
| A1 existing agent: owner, tokenURI, registration file | `test/A1.identity.test.js` (Base 1 data: URI, Base 3 https, Base Sepolia 1 full file, Base Sepolia 5 empty tokenURI) | done |
| A2 ipfs:// and data: tokenURIs | `test/A2.uris.test.js` (base64 and plain data:, ipfs on Base Sepolia 2, gateway fallback) | done |
| A3 empty state, error state, nothing throws | `test/A3.states.test.js` (recorded revert, zero address, RPC down, file 404, garbage answers, bad ids) | done |
| A4 reputation summarised, no feedback said | `test/A4.reputation.test.js` (Base 1: 47 entries, Base Sepolia 5: none, decimals, negatives, revoked) | done |
| A5 Base and Base Sepolia, Kognai's Sepolia test identity | `test/A5.networks.test.js` | done except the Kognai test identity: `todo` until Kognai publishes its id (then set `KOGNAI_TEST_IDENTITY` in `config.js` and record it) |
| A6 mobile (360 px), light and dark | `test/A6.page.test.js` | done |

## Deploy

`npm run deploy` copies the five static files into `dist/` and runs `wrangler deploy` (Cloudflare Workers static assets, free plan).

## Licence

MIT. Kognessium job: `c0f382e5-c8cc-4f81-a415-12fee895f216`.
