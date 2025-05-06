import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const { URUK_TOKEN, DEV_WALLET, URUK_DECIMALS } = process.env;
  if (!URUK_TOKEN || !DEV_WALLET || !URUK_DECIMALS)
    throw new Error(
      "Environment variables not set (URUK_TOKEN, DEV_WALLET, URUK_DECIMALS are required)"
    );

  const urukDecimals = parseInt(URUK_DECIMALS, 10);
  if (isNaN(urukDecimals) || urukDecimals < 0 || urukDecimals > 255) {
    throw new Error(
      "Invalid URUK_DECIMALS value. (Must be an integer between 0 and 255)"
    );
  }

  // ① Deploy (add decimals as the third argument)
  const Fac = await ethers.getContractFactory("UrukLottery");
  const lot = await Fac.deploy(URUK_TOKEN, DEV_WALLET, urukDecimals);
  await lot.waitForDeployment();

  // ② Get address
  const address: string = await lot.getAddress(); // Casting removed (ethers v6+)

  console.log("UrukLottery deployed to:", address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
