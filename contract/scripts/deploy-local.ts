import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  // 1) MockURUK 배포
  const Mock = await ethers.getContractFactory("MockURUK");
  const mock = await Mock.deploy();
  await mock.waitForDeployment();

  console.log("MockURUK:", await mock.getAddress());

  // 2) UrukLottery 배포 (token, devWallet)
  const Lottery = await ethers.getContractFactory("UrukLottery");
  const lotto = await Lottery.deploy(await mock.getAddress(), deployer.address);
  await lotto.waitForDeployment();

  console.log("UrukLottery:", await lotto.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
const uruk = await ethers.getContractAt("MockURUK", URUK, signer);
