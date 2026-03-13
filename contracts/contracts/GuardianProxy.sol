// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GuardianProxy {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    event TransactionIntercepted(
        string indexed txId,
        string riskLevel,
        string intentSummary,
        uint256 timestamp
    );

    event TransactionRewritten(
        string indexed txId,
        string rewriteReason,
        uint256 timestamp
    );

    event DecisionRecorded(
        string indexed txId,
        string decision,
        string reason,
        uint256 timestamp
    );

    event TransactionApproved(
        address indexed target,
        uint256 value,
        string riskLevel,
        uint256 timestamp
    );

    event TransactionRejected(
        string reason,
        uint256 timestamp
    );

    constructor() {
        owner = msg.sender;
    }

    function logInterception(
        string calldata txId,
        string calldata riskLevel,
        string calldata intentSummary
    ) external onlyOwner {
        emit TransactionIntercepted(txId, riskLevel, intentSummary, block.timestamp);
    }

    function logRewrite(
        string calldata txId,
        string calldata rewriteReason
    ) external onlyOwner {
        emit TransactionRewritten(txId, rewriteReason, block.timestamp);
    }

    function logDecision(
        string calldata txId,
        string calldata decision,
        string calldata reason
    ) external onlyOwner {
        emit DecisionRecorded(txId, decision, reason, block.timestamp);
    }

    function executeSafe(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata riskLevel
    ) external payable returns (bool success, bytes memory result) {
        (success, result) = target.call{value: value}(data);
        require(success, "Transaction execution failed");

        emit TransactionApproved(target, value, riskLevel, block.timestamp);
    }

    function logRejection(string calldata reason) external {
        emit TransactionRejected(reason, block.timestamp);
    }

    receive() external payable {}
}
