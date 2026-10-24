// ERC-8004 deployments targeted by the viewer.
// Source: https://github.com/erc-8004/erc-8004-contracts (README, "Base Mainnet" and "Base Sepolia"),
// the reference deployment of the ERC-8004 authors. Same vanity addresses on every mainnet / testnet.
export const REGISTRIES = {
  base: {
    identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  },
  "base-sepolia": {
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
};

// Public JSON-RPC endpoints (free, no key). Any other endpoint can be given to loadAgent.
export const RPC_URLS = {
  base: "https://mainnet.base.org",
  "base-sepolia": "https://sepolia.base.org",
};

export const CHAIN_IDS = { base: 8453, "base-sepolia": 84532 };

export const EXPLORERS = {
  base: "https://basescan.org",
  "base-sepolia": "https://sepolia.basescan.org",
};

export const IPFS_GATEWAY = "https://ipfs.io/ipfs/";
// tried in order by the default fetchJson when a gateway fails or rate limits
export const IPFS_GATEWAYS = [IPFS_GATEWAY, "https://dweb.link/ipfs/", "https://gateway.pinata.cloud/ipfs/"];

// Test identity Kognai publishes for this bundle on Base Sepolia.
// Until Kognai publishes its id, the page and test A5 use a public Sepolia agent (id 1).
export const KOGNAI_TEST_IDENTITY = { network: "base-sepolia", agentId: null };
