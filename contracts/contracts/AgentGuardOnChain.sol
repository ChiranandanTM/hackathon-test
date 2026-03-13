// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract AgentGuardOnChain {
    mapping(address => bytes32) public intentHashOf;

    event IntentApproved(address indexed user, bytes32 intentHash);
    event IntentExecuted(address indexed user, address indexed token, address indexed to, uint256 amount);

    function _hashIntent(address token, address to, uint256 amount) internal pure returns (bytes32) {
        return keccak256(abi.encode(token, to, amount));
    }

    function approveIntent(address token, address to, uint256 amount) external {
        require(token != address(0), "token required");
        require(to != address(0), "recipient required");
        require(amount > 0, "amount required");

        bytes32 h = _hashIntent(token, to, amount);
        intentHashOf[msg.sender] = h;
        emit IntentApproved(msg.sender, h);
    }

    function validateAndExecute(address token, address to, uint256 amount) external {
        bytes32 expected = intentHashOf[msg.sender];
        require(expected != bytes32(0), "intent not approved");

        bytes32 incoming = _hashIntent(token, to, amount);
        require(incoming == expected, "Payload substitution detected");

        bool ok = IERC20Like(token).transferFrom(msg.sender, to, amount);
        require(ok, "transfer failed");

        emit IntentExecuted(msg.sender, token, to, amount);
    }
}
