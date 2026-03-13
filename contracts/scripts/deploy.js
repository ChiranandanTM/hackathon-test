const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("MockUSDC deployed to:", mockUSDCAddress);

  // Deploy GuardianProxy
  const GuardianProxy = await ethers.getContractFactory("GuardianProxy");
  const guardianProxy = await GuardianProxy.deploy();
  await guardianProxy.waitForDeployment();
  const guardianProxyAddress = await guardianProxy.getAddress();
  console.log("GuardianProxy deployed to:", guardianProxyAddress);

  // Transfer 1000 MockUSDC to GuardianProxy
  const transferAmount = ethers.parseUnits("1000", 6);
  const tx = await mockUSDC.transfer(guardianProxyAddress, transferAmount);
  await tx.wait();
  console.log("Transferred 1000 MockUSDC to GuardianProxy");

  console.log("\n--- Deployment Summary ---");
  console.log("MockUSDC:", mockUSDCAddress);
  console.log("GuardianProxy:", guardianProxyAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
