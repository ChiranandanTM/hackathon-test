MAX_UINT256 = 2**256 - 1
MAX_UINT256_HEX = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

KNOWN_CONTRACTS = [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",  # USDT
    "0x6B175474E89094C44Da98b954EedeAC495271d0F",  # DAI
]

SEVERITY_WEIGHTS = {
    "critical": 90,
    "high": 65,
    "medium": 35,
    "low": 10,
}


def _safe_to_int(value) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        return int(value, 16) if value.startswith("0x") else int(value)
    return 0


def _risk_score(flags: list, risk_level: str) -> int:
    if not flags:
        return 0
    max_weight = max(SEVERITY_WEIGHTS.get(flag.get("severity", "low"), 10) for flag in flags)
    stacked_bonus = min(10, max(0, len(flags) - 1) * 4)
    level_bias = {
        "critical": 8,
        "high": 5,
        "medium": 2,
        "low": 0,
    }.get(risk_level, 0)
    return min(100, max_weight + stacked_bonus + level_bias)


def detect_risks(tx: dict) -> dict:
    # FIXED: Added comprehensive try/except wrapper for null safety
    try:
        if not tx or not isinstance(tx, dict):
            return {
                "risk_level": "critical",
                "flags": [{
                    "type": "malformed_input",
                    "severity": "critical",
                    "description": "Transaction data is invalid or missing.",
                }],
                "is_safe": False,
                "risk_score": 100,
                "requires_human_review": True,
                "policy_action": "block_and_rewrite",
                "top_threat": "malformed_input",
            }
        
        flags = []
        risk_level = "low"

        # Check for infinite token approval
        if tx.get("function_name") == "approve":
            try:
                amount = _safe_to_int(tx.get("args", {}).get("amount", 0))
                if amount >= MAX_UINT256 or str(amount) == str(MAX_UINT256):
                    flags.append({
                        "type": "infinite_approval",
                        "severity": "critical",
                        "description": "This transaction grants unlimited token spending permission. "
                        "A malicious contract could drain all your tokens.",
                    })
                    risk_level = "critical"
            except Exception as e:
                # Silently skip if approval amount check fails
                pass

        # Check for wallet drain
        if tx.get("function_name") in ("transfer", "transferFrom"):
            try:
                amount = _safe_to_int(tx.get("args", {}).get("amount", 0))
                wallet_balance = tx.get("wallet_balance", 0) or 0
                if wallet_balance > 0 and amount > wallet_balance * 0.9:
                    flags.append({
                        "type": "wallet_drain",
                        "severity": "high",
                        "description": f"This transaction attempts to spend {min(100, amount / max(wallet_balance, 1) * 100):.0f}% "
                        "of your wallet balance. This could be a wallet drain attack.",
                    })
                    if risk_level != "critical":
                        risk_level = "high"
            except Exception as e:
                # Silently skip if wallet drain check fails
                pass

        # Check for unverified contract
        to_address = tx.get("to_address", "")
        if to_address and isinstance(to_address, str) and to_address not in KNOWN_CONTRACTS:
            flags.append({
                "type": "unverified_contract",
                "severity": "medium",
                "description": f"The target contract ({to_address[:10]}...)is not in our verified list. "
                "Proceed with caution.",
            })
            if risk_level == "low":
                risk_level = "medium"

        is_safe = len(flags) == 0
        risk_score = _risk_score(flags, risk_level)
        requires_human_review = risk_score >= 30
        policy_action = "allow" if risk_score < 30 else ("review" if risk_score < 70 else "block_and_rewrite")
        top_threat = flags[0]["type"] if flags else "none"

        return {
            "risk_level": risk_level,
            "flags": flags,
            "is_safe": is_safe,
            "risk_score": risk_score,
            "requires_human_review": requires_human_review,
            "policy_action": policy_action,
            "top_threat": top_threat,
        }
    
    except Exception as e:
        # FIXED: Fallback for ANY exception during risk detection
        return {
            "risk_level": "critical",
            "flags": [{
                "type": "detection_error",
                "severity": "critical",
                "description": f"Risk detection failed: {str(e)[:100]}. Blocking transaction for safety.",
            }],
            "is_safe": False,
            "risk_score": 100,
            "requires_human_review": True,
            "policy_action": "block_and_rewrite",
            "top_threat": "detection_error",
        }
