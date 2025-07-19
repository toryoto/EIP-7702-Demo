import { ethers } from "hardhat";
import { MinimalEIP7702Delegate__factory } from "../../typechain-types";

async function main() {
  console.log("Starting EIP7702Delegate deployment...");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  // Deploy MinimalEIP7702Delegate
  console.log("\nDeploying MinimalEIP7702Delegate...");
  const delegateFactory = new MinimalEIP7702Delegate__factory(deployer);
  const delegate = await delegateFactory.deploy();
  await delegate.waitForDeployment();
  
  const delegateAddress = await delegate.getAddress();
  console.log("MinimalEIP7702Delegate deployed to:", delegateAddress);

  // Verify deployment
  const deploymentCode = await ethers.provider.getCode(delegateAddress);
  console.log("Deployment verified:", deploymentCode.length > 2 ? "✓" : "✗");

  // Log deployment info
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Contract Address:", delegateAddress);
  console.log("Deployer:", deployer.address);
  console.log("==========================\n");

  // Save deployment info to return
  return {
    delegateAddress,
    deployer: deployer.address,
    network: (await ethers.provider.getNetwork()).name
  };
}

// Execute deployment
main()
  .then((result) => {
    console.log("Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });