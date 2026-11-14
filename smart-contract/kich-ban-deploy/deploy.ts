import { network } from "hardhat";

async function main() {
  console.log("Dang ket noi toi mang Sepolia...");
  const { ethers } = await network.connect();

  const [deployer] = await ethers.getSigners();
  console.log("Tai khoan trien khai (Admin):", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("So du vi:", ethers.formatEther(balance), "SepoliaETH");

  console.log("Dang trien khai hop dong CertificateRegistry...");
  const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
  const registry = await CertificateRegistry.deploy();

  await registry.waitForDeployment();
  const contractAddress = await registry.getAddress();

  console.log("--------------------------------------------------");
  console.log("TRIEN KHAI THANH CONG!");
  console.log("Dia chi Smart Contract:", contractAddress);
  console.log("--------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});