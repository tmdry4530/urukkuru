// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * UrukLottery ? 30?minute window, 1 URUK = 1 ticket, blockhash RNG
 * UX ?? ? ??: buyTickets(uint256 **ticketCount**)  ? ????? ??? ???? ??? ??
 */

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UrukLottery is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant DEV_FEE_BPS = 250; // 2.5?%
    uint256 public constant BPS_DENOM = 10_000;
    uint256 public constant ROUND_SPAN = 3 minutes; // 30?

    IERC20Metadata public immutable uruk;
    uint256 public immutable ticketUnit; // 1 URUK (???)
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

    /* helpers */
    function activeRoundId() public view returns (uint256) {
        return block.timestamp / ROUND_SPAN;
    }
    function roundEnd(uint256 r) public pure returns (uint256) {
        return (r + 1) * ROUND_SPAN;
    }

    /* buy ? ??? **?? ??**(??)? ?? */
    function buyTickets(uint256 ticketCount) external nonReentrant {
        require(ticketCount > 0, "ticket 0");
        uint256 amount = ticketCount * ticketUnit;

        uint256 rid = activeRoundId();
        Round storage r = rounds[rid];

        // transferFrom - ERC20 revert ??? explorer ?? ???
        uruk.safeTransferFrom(msg.sender, address(this), amount);

        uint256 pos = indexOf[rid][msg.sender];
        if (pos == 0) {
            plist[rid].push(Participant(msg.sender, ticketCount));
            indexOf[rid][msg.sender] = plist[rid].length;
        } else {
            plist[rid][pos - 1].tickets += ticketCount;
        }
        r.ticketCount += ticketCount;
        r.pot += amount;

        emit TicketPurchased(rid, msg.sender, ticketCount, amount);
    }

    /* draw */
    function draw() external nonReentrant {
        uint256 rid = activeRoundId() - 1;
        Round storage r = rounds[rid];
        require(
            !r.completed &&
                block.timestamp >= roundEnd(rid) &&
                r.ticketCount > 0,
            "state"
        );

        uint256 rand = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    rid,
                    r.pot,
                    address(this)
                )
            )
        ) % r.ticketCount;

        uint256 acc;
        address winner;
        Participant[] storage arr = plist[rid];
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

        emit WinnerSelected(rid, winner, r.pot - devFee, devFee);
    }

    /* view functions */
    function getTicketsOf(
        address user,
        uint256 roundId
    ) external view returns (uint256) {
        uint256 index = indexOf[roundId][user];
        if (index == 0) {
            // User did not participate or round doesn't exist for user
            return 0;
        }
        // Ensure index is within bounds (should be guaranteed by indexOf logic, but for safety)
        if (index > plist[roundId].length) {
            return 0;
        }
        return plist[roundId][index - 1].tickets;
    }

    /* admin */
    function setDevWallet(address w) external onlyOwner {
        require(w != address(0));
        devWallet = w;
    }
}
