import os
from typing import Dict, Any

from dotenv import load_dotenv

load_dotenv()

try:
    from web3 import Web3
except Exception:  # pragma: no cover
    Web3 = None


RPC_URL = os.getenv("ETH_RPC_URL", "")
PRIVATE_KEY = os.getenv("ETH_PRIVATE_KEY", "")
GUARDIAN_PROXY_ADDRESS = os.getenv("GUARDIAN_PROXY_ADDRESS", "")

GUARDIAN_PROXY_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "txId", "type": "string"},
            {"internalType": "string", "name": "riskLevel", "type": "string"},
            {"internalType": "string", "name": "intentSummary", "type": "string"},
        ],
        "name": "logInterception",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "string", "name": "txId", "type": "string"},
            {"internalType": "string", "name": "rewriteReason", "type": "string"},
        ],
        "name": "logRewrite",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "string", "name": "txId", "type": "string"},
            {"internalType": "string", "name": "decision", "type": "string"},
            {"internalType": "string", "name": "reason", "type": "string"},
        ],
        "name": "logDecision",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def _is_enabled() -> bool:
    return bool(Web3 and RPC_URL and PRIVATE_KEY and GUARDIAN_PROXY_ADDRESS)


def _disabled_response(reason: str) -> Dict[str, Any]:
    return {
        "enabled": False,
        "recorded": False,
        "reason": reason,
    }


def _send_transaction(fn) -> Dict[str, Any]:
    if not _is_enabled():
        return _disabled_response("Missing ETH_RPC_URL / ETH_PRIVATE_KEY / GUARDIAN_PROXY_ADDRESS")

    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not w3.is_connected():
            return _disabled_response("Unable to connect to ETH RPC provider")

        account = w3.eth.account.from_key(PRIVATE_KEY)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(GUARDIAN_PROXY_ADDRESS),
            abi=GUARDIAN_PROXY_ABI,
        )

        tx = fn(contract).build_transaction(
            {
                "from": account.address,
                "nonce": w3.eth.get_transaction_count(account.address),
                "gas": 250000,
                "gasPrice": w3.eth.gas_price,
                "chainId": w3.eth.chain_id,
            }
        )

        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        return {
            "enabled": True,
            "recorded": bool(receipt.status == 1),
            "tx_hash": tx_hash.hex(),
            "block_number": receipt.blockNumber,
        }
    except Exception as exc:  # pragma: no cover
        return {
            "enabled": True,
            "recorded": False,
            "reason": str(exc),
        }


def log_interception_onchain(tx_id: str, risk_level: str, intent_summary: str) -> Dict[str, Any]:
    return _send_transaction(
        lambda contract: contract.functions.logInterception(
            str(tx_id), str(risk_level or "unknown"), str(intent_summary or "")
        )
    )


def log_rewrite_onchain(tx_id: str, rewrite_reason: str) -> Dict[str, Any]:
    return _send_transaction(
        lambda contract: contract.functions.logRewrite(str(tx_id), str(rewrite_reason or ""))
    )


def log_decision_onchain(tx_id: str, decision: str, reason: str = "") -> Dict[str, Any]:
    return _send_transaction(
        lambda contract: contract.functions.logDecision(
            str(tx_id), str(decision or "pending"), str(reason or "")
        )
    )
