const { ethers } = require("hardhat");

// Contract verification script for ETHIndia Ethereum Track
// Demonstrates sophisticated Ethereum contract interaction

async function verifyDeployment() {
  const [deployer] = await ethers.getSigners();
  console.log("🔐 ETHIndia Ethereum Track - Contract Verification");
  console.log("================================================\n");
  console.log("Verifying contracts with:", deployer.address);

  // Get deployed contract addresses from environment
  const mockUSDCAddress = process.env.MOCKUSDC_ADDRESS;
  const guardianProxyAddress = process.env.GUARDIAN_PROXY_ADDRESS;

  if (!mockUSDCAddress || !guardianProxyAddress) {
    console.error("❌ Contract addresses not found in environment variables");
    process.exit(1);
  }

  console.log("MockUSDC Address:", mockUSDCAddress);
  console.log("GuardianProxy Address:", guardianProxyAddress);

  // Verify MockUSDC
  const MockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);
  console.log("\n📝 MockUSDC Verification:");
  try {
    const name = await MockUSDC.name();
    const symbol = await MockUSDC.symbol();
    const decimals = await MockUSDC.decimals();
    const totalSupply = await MockUSDC.totalSupply();
    console.log(`  ✓ Name: ${name}`);
    console.log(`  ✓ Symbol: ${symbol}`);
    console.log(`  ✓ Decimals: ${decimals}`);
    console.log(`  ✓ Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
  } catch (err) {
    console.error("  ❌ Failed to verify MockUSDC:", err.message);
  }

  // Verify GuardianProxy
  const GuardianProxy = await ethers.getContractAt("GuardianProxy", guardianProxyAddress);
  console.log("\n📝 GuardianProxy Verification:");
  try {
    const owner = await GuardianProxy.owner();
    console.log(`  ✓ Owner: ${owner}`);
    console.log(`  ✓ Owner matches deployer: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);

    // Check contract balance
    const balance = await MockUSDC.balanceOf(guardianProxyAddress);
    console.log(`  ✓ Guardian Balance: ${ethers.formatUnits(balance, 6)} USDC`);
  } catch (err) {
    console.error("  ❌ Failed to verify GuardianProxy:", err.message);
  }

  console.log("\n✅ ETHIndia Ethereum Track - Verification Complete");
}

verifyDeployment().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
