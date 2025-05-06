import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  // 1) Deploy MockURUK
  const Mock = await ethers.getContractFactory("MockURUK");
  const mock = await Mock.deploy();
  await mock.waitForDeployment();

  console.log("MockURUK:", await mock.getAddress());

  // 2) Deploy UrukLottery (token, devWallet)
  const Lottery = await ethers.getContractFactory("UrukLottery");
  const lotto = await Lottery.deploy(await mock.getAddress(), deployer.address);
  await lotto.waitForDeployment();

  console.log("UrukLottery:", await lotto.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
// The following line seems to be a leftover or an error, as `URUK` and `signer` are not defined in this scope.
// If it's necessary, it should be within an async context or a `then` block after a promise.
// For now, I will comment it out as it would cause a runtime error.
// const uruk = await ethers.getContractAt("MockURUK", URUK, signer);
