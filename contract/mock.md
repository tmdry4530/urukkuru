/******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******

- 1. Load .env + Address Constants
     ******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******/
     require("dotenv").config(); // <- OK if undefined is output

const LOTTERY = process.env.LOTTERY_ADDRESS; // Actual address
const URUK = process.env.URUK_TOKEN; // .env value

/******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******

- 2. Signer and Contract Instances (declare all anew)
     ******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******/
     const [signer] = await ethers.getSigners();

const lottery = await ethers.getContractAt("UrukLottery", LOTTERY, signer);
const uruk = await ethers.getContractAt("IERC20Metadata", URUK, signer);

/******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******

- 3. Check Token Information
     ******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******/
     const decimals = await uruk.decimals(); // e.g., 18
     const symbol = await uruk.symbol(); // e.g., "TEST"
     console.log(symbol, "decimals:", decimals.toString());

/******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******

- 4. Helper Functions
     ******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******/
     const toWei = (n) => ethers.parseUnits(n.toString(), decimals);
     const fromWei = (x) => Number(ethers.formatUnits(x, decimals));

/******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******

- 5. Check Balance & Allowance
     ******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******/
     const bal = await uruk.balanceOf(signer.address);
     const allow = await uruk.allowance(signer.address, lottery.target);
     console.log("Balance:", fromWei(bal), symbol);
     console.log("Allowance:", fromWei(allow), symbol);

/******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******

- 6. Approve + Purchase Example (10 TEST tokens = 10 tickets)
     ******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******/
     await uruk.approve(lottery.target, toWei(10)); // Only needs to be done once
     await lottery.buyTickets(toWei(10));

/******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******

- 7. Round Status
     ******\*\*******\*\*******\*\*******\*\*\*\*******\*\*******\*\*******\*\*******/
     const rid = await lottery.activeRoundId();
     const round = await lottery.rounds(rid);
     console.log(`Round #${rid} Ticket Count:`, round.ticketCount.toString());

await network.provider.send("evm_increaseTime", [21600]); // 6 h
await network.provider.send("evm_mine");
await lottery.draw();
