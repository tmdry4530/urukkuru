// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UrukLottery is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant DEV_FEE_BPS = 250;
    uint256 public constant BPS_DENOM = 10_000;

    IERC20Metadata public immutable uruk;
    uint256 public immutable ticketUnit;
    uint8 public immutable decimals;

    address public devWallet;

    struct Round {
        uint256 pot;
        uint256 ticketCount;
        bool completed;
        address winner;
    }
    mapping(uint256 => Round) public rounds;

    struct Participant {
        address addr;
        uint256 tickets;
    }
    mapping(uint256 => Participant[]) private plist;
    mapping(uint256 => mapping(address => uint256)) private indexOf;

    event TicketPurchased(
        uint256 indexed rid,
        address indexed player,
        uint256 tickets,
        uint256 paid
    );
    event WinnerSelected(
        uint256 indexed rid,
        address indexed winner,
        uint256 prize,
        uint256 devFee
    );

    constructor(
        address _uruk,
        address _devWallet,
        uint8 _decimals
    ) Ownable(msg.sender) {
        require(_uruk != address(0) && _devWallet != address(0), "zero");
        uruk = IERC20Metadata(_uruk);
        decimals = _decimals;
        ticketUnit = 10 ** _decimals;
        devWallet = _devWallet;
    }

    // buyTickets에서 roundId를 파라미터로 받음
    function buyTickets(
        uint256 roundId,
        uint256 ticketCount
    ) external nonReentrant {
        require(ticketCount > 0, "ticket 0");
        uint256 amount = ticketCount * ticketUnit;

        Round storage r = rounds[roundId];

        uruk.safeTransferFrom(msg.sender, address(this), amount);

        uint256 pos = indexOf[roundId][msg.sender];
        if (pos == 0) {
            plist[roundId].push(Participant(msg.sender, ticketCount));
            indexOf[roundId][msg.sender] = plist[roundId].length;
        } else {
            plist[roundId][pos - 1].tickets += ticketCount;
        }
        r.ticketCount += ticketCount;
        r.pot += amount;

        emit TicketPurchased(roundId, msg.sender, ticketCount, amount);
    }

    // draw도 roundId를 파라미터로 받음
    function draw(uint256 roundId) external nonReentrant {
        Round storage r = rounds[roundId];
        require(!r.completed && r.ticketCount > 0, "state");

        uint256 rand = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    roundId,
                    r.pot,
                    address(this)
                )
            )
        ) % r.ticketCount;

        uint256 acc;
        address winner;
        Participant[] storage arr = plist[roundId];
        for (uint256 i; i < arr.length; ++i) {
            acc += arr[i].tickets;
            if (rand < acc) {
                winner = arr[i].addr;
                break;
            }
        }
        r.completed = true;
        r.winner = winner;

        uint256 devFee = (r.pot * DEV_FEE_BPS) / BPS_DENOM;
        uruk.safeTransfer(winner, r.pot - devFee);
        uruk.safeTransfer(devWallet, devFee);

        emit WinnerSelected(roundId, winner, r.pot - devFee, devFee);
    }

    // getTicketsOf 등 view 함수는 동일하게 roundId를 파라미터로 받음
    function getTicketsOf(
        address user,
        uint256 roundId
    ) external view returns (uint256) {
        uint256 index = indexOf[roundId][user];
        if (index == 0) {
            return 0;
        }
        if (index > plist[roundId].length) {
            return 0;
        }
        return plist[roundId][index - 1].tickets;
    }

    function setDevWallet(address w) external onlyOwner {
        require(w != address(0));
        devWallet = w;
    }
}
