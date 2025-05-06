import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const { URUK_TOKEN, DEV_WALLET, URUK_DECIMALS } = process.env;
  if (!URUK_TOKEN || !DEV_WALLET || !URUK_DECIMALS)
    throw new Error("env 미설정 (URUK_TOKEN, DEV_WALLET, URUK_DECIMALS 필요)");

  const urukDecimals = parseInt(URUK_DECIMALS, 10);
  if (isNaN(urukDecimals) || urukDecimals < 0 || urukDecimals > 255) {
    throw new Error(
      "유효하지 않은 URUK_DECIMALS 값입니다. (0-255 사이의 정수여야 함)"
    );
  }

  // ① 배포 (세 번째 인자로 decimals 추가)
  const Fac = await ethers.getContractFactory("UrukLottery");
  const lot = await Fac.deploy(URUK_TOKEN, DEV_WALLET, urukDecimals);
  await lot.waitForDeployment();

  // ② 주소 얻기
  const address: string = await lot.getAddress(); // 캐스팅 제거 (ethers v6+)

  console.log("UrukLottery deployed to:", address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
