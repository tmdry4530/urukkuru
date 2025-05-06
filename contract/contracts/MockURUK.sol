// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockURUK is ERC20 {
    constructor() ERC20("MockURUK", "URUK") {
        _mint(msg.sender, 1_000_000 * 1e18); // 배포자에게 1M URUK
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
