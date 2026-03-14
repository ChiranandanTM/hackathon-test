// Auto-generated config fallback for LiveAttackDemo.
// contracts/scripts/deployDemo.js can overwrite this file with real values.

export const DEMO_CONFIG = {
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  chainId: 11155111,
  explorerBaseUrl: "https://sepolia.etherscan.io/tx/",
  contracts: {
    mockUsdc: "0x0000000000000000000000000000000000000000",
    attackSimulator: "0x0000000000000000000000000000000000000000",
    agentGuardOnChain: "0x0000000000000000000000000000000000000000",
  },
  demoWallets: {
    // If privateKey is blank, LiveAttackDemo uses connected browser wallet for Alex.
    alex: { address: "0x0ab3fc575447eec8545a0c619435f26dbf23fe73", privateKey: "2f6fc2c2acdb47ee15099214470433ed9c4dd2f4a824b6c1232843428a0ef810" },
    // Optional: set Sam private key if you want actual Sam-chain execution path.
    sam: { address: "0x0000000000000000000000000000000000000002", privateKey: "" },
    attacker: { address: "0x000000000000000000000000000000000000dEaD", privateKey: "" },
    benignRecipient: "0x1111111111111111111111111111111111111111",
  },
  initialAmount: "500",
  drainAmount: "0.0001",
  tokenDecimals: 6,
};

export const ATTACK_SIMULATOR_ABI = [
  "function drainWallet(address token,address victim,address to,uint256 amount) external",
];

export const AGENT_GUARD_ONCHAIN_ABI = [
  "function approveIntent(address token,address to,uint256 amount) external",
  "function validateAndExecute(address token,address to,uint256 amount) external",
  "function intentHashOf(address user) external view returns (bytes32)",
];

export const MOCK_USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner,address spender) external view returns (uint256)",
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];
