// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("Starting deployment of Blockchain Access Control System...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString(), "\n");

  // Deploy AccessControlManager
  console.log("Deploying AccessControlManager...");
  const AccessControlManager = await hre.ethers.getContractFactory("AccessControlManager");
  const accessControlManager = await AccessControlManager.deploy();
  await accessControlManager.deployed();
  console.log("✅ AccessControlManager deployed to:", accessControlManager.address);

  // Deploy PolicyRegistry
  console.log("\nDeploying PolicyRegistry...");
  const PolicyRegistry = await hre.ethers.getContractFactory("PolicyRegistry");
  const policyRegistry = await PolicyRegistry.deploy();
  await policyRegistry.deployed();
  console.log("✅ PolicyRegistry deployed to:", policyRegistry.address);

  // Deploy RoleHierarchy
  console.log("\nDeploying RoleHierarchy...");
  const RoleHierarchy = await hre.ethers.getContractFactory("RoleHierarchy");
  const roleHierarchy = await RoleHierarchy.deploy();
  await roleHierarchy.deployed();
  console.log("✅ RoleHierarchy deployed to:", roleHierarchy.address);

  // Save deployment addresses
  const fs = require('fs');
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      AccessControlManager: accessControlManager.address,
      PolicyRegistry: policyRegistry.address,
      RoleHierarchy: roleHierarchy.address
    }
  };

  fs.writeFileSync(
    'deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("\nContract Addresses:");
  console.log("  AccessControlManager:", accessControlManager.address);
  console.log("  PolicyRegistry:", policyRegistry.address);
  console.log("  RoleHierarchy:", roleHierarchy.address);
  console.log("\n✅ Deployment information saved to deployment-info.json");
  console.log("=".repeat(60));

  // Wait for block confirmations on testnets/mainnet
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await accessControlManager.deployTransaction.wait(5);
    await policyRegistry.deployTransaction.wait(5);
    await roleHierarchy.deployTransaction.wait(5);
    console.log("✅ Contracts confirmed on blockchain");

    // Verify contracts on Etherscan
    console.log("\nVerifying contracts on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: accessControlManager.address,
        constructorArguments: [],
      });
      console.log("✅ AccessControlManager verified");
    } catch (error) {
      console.log("⚠️  AccessControlManager verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: policyRegistry.address,
        constructorArguments: [],
      });
      console.log("✅ PolicyRegistry verified");
    } catch (error) {
      console.log("⚠️  PolicyRegistry verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: roleHierarchy.address,
        constructorArguments: [],
      });
      console.log("✅ RoleHierarchy verified");
    } catch (error) {
      console.log("⚠️  RoleHierarchy verification failed:", error.message);
    }
  }

  console.log("\n🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
