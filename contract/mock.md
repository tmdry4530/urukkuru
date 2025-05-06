/**************\*\***************\*\*\*\***************\*\***************

- 1.  .env 로드 + 주소 상수
      **************\*\***************\*\*\*\***************\*\***************/
      require("dotenv").config(); // <- undefined 출력이면 OK

const LOTTERY = process.env.LOTTERY_ADDRESS; // 실제 주소
const URUK = process.env.URUK_TOKEN; // .env 값

/**************\*\***************\*\*\*\***************\*\***************

- 2.  서명자 및 컨트랙트 인스턴스 (모두 새로 선언)
      **************\*\***************\*\*\*\***************\*\***************/
      const [signer] = await ethers.getSigners();

const lottery = await ethers.getContractAt("UrukLottery", LOTTERY, signer);
const uruk = await ethers.getContractAt("IERC20Metadata", URUK, signer);

/**************\*\***************\*\*\*\***************\*\***************

- 3.  토큰 정보 확인
      **************\*\***************\*\*\*\***************\*\***************/
      const decimals = await uruk.decimals(); // ex) 18
      const symbol = await uruk.symbol(); // ex) "TEST"
      console.log(symbol, "decimals:", decimals.toString());

/**************\*\***************\*\*\*\***************\*\***************

- 4.  헬퍼 함수
      **************\*\***************\*\*\*\***************\*\***************/
      const toWei = (n) => ethers.parseUnits(n.toString(), decimals);
      const fromWei= (x) => Number(ethers.formatUnits(x, decimals));

/**************\*\***************\*\*\*\***************\*\***************

- 5.  잔액·허용량 확인
      **************\*\***************\*\*\*\***************\*\***************/
      const bal = await uruk.balanceOf(signer.address);
      const allow = await uruk.allowance(signer.address, lottery.target);
      console.log("잔액:", fromWei(bal), symbol);
      console.log("Allowance:", fromWei(allow), symbol);

/**************\*\***************\*\*\*\***************\*\***************

- 6.  승인 + 구매 예시 (10 TEST 토큰 = 10장)
      **************\*\***************\*\*\*\***************\*\***************/
      await uruk.approve(lottery.target, toWei(10)); // 한 번만 하면 됨
      await lottery.buyTickets(toWei(10));

/**************\*\***************\*\*\*\***************\*\***************

- 7.  라운드 상태
      **************\*\***************\*\*\*\***************\*\***************/
      const rid = await lottery.activeRoundId();
      const round = await lottery.rounds(rid);
      console.log(`라운드 #${rid} 티켓 수:`, round.ticketCount.toString());

await network.provider.send("evm_increaseTime", [21600]); // 6 h
await network.provider.send("evm_mine");
await lottery.draw();
