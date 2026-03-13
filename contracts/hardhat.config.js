require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const sepoliaRpcUrl =
  process.env.SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";
const deployerKey = process.env.PRIVATE_KEY || process.env.DEMO_DEPLOYER_PRIVATE_KEY || "";

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      // Keep a non-empty default URL to avoid HH117 in demo setup.
      url: sepoliaRpcUrl,
      accounts: deployerKey ? [deployerKey] : [],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
