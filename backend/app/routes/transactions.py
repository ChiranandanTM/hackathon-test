from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime, timezone
from bson import ObjectId
from firebase_admin import firestore

from app.database import transactions_collection, STORAGE_MODE

from app.services.risk_detector import detect_risks
from app.services.llm_service import analyze_transaction
from app.services.tx_rewriter import rewrite_safe
from app.services.blockchain_audit import (
    log_interception_onchain,
    log_rewrite_onchain,
    log_decision_onchain,
)

router = APIRouter()


class TransactionRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    from_address: Optional[str] = None
    to_address: Optional[str] = None
    function_name: Optional[str] = None
    args: Optional[dict] = None
    value: Optional[float] = 0
    user_intent: Optional[str] = "Unknown"
    wallet_balance: Optional[float] = 0
    tx_type: Optional[str] = None
    spender: Optional[str] = None
    amount: Optional[str] = None
    token: Optional[str] = None
    initiated_by: Optional[str] = None
    attack_simulation: Optional[bool] = False
    attack_type: Optional[str] = None
    to: Optional[str] = None
    contract: Optional[str] = None
    method: Optional[str] = None
    params: Optional[dict] = None
    gas_limit: Optional[str] = None
    
class ActionRequest(BaseModel):
    reason: Optional[str] = ""


def serialize_doc(doc):
    doc["_id"] = str(doc["_id"])
    return doc


def _make_id_query(tx_id: str) -> dict:
    """Create ID query for active storage backend."""
    return {"_id": tx_id}


def _normalize_intercept_payload(payload: dict[str, Any]) -> dict[str, Any]:
    tx_type = payload.get("tx_type")

    if tx_type == "approve":
        function_name = "approve"
        args = {
            "spender": payload.get("spender", ""),
            "amount": payload.get("amount", "0"),
        }
        to_address = payload.get("spender", payload.get("to_address", ""))
    elif tx_type == "transfer":
        function_name = "transfer"
        args = {
            "to": payload.get("to", ""),
            "amount": payload.get("amount", "0"),
        }
        to_address = payload.get("to", payload.get("to_address", ""))
    elif tx_type == "contract_call":
        function_name = payload.get("method", "contract_call")
        args = payload.get("params") or {}
        to_address = payload.get("contract", payload.get("to_address", ""))
    else:
        function_name = payload.get("function_name", "unknown")
        args = payload.get("args") or {}
        to_address = payload.get("to_address", "")
        if function_name == "approve":
            tx_type = "approve"
        elif function_name in ("transfer", "transferFrom"):
            tx_type = "transfer"
        else:
            tx_type = "contract_call"

    attack_type = payload.get("attack_type") or "unknown"
    user_intent = payload.get("user_intent")
    if not user_intent:
        user_intent = f"Simulated {attack_type} triggered by {payload.get('initiated_by', 'user')}"

    return {
        "tx_type": tx_type,
        "from_address": payload.get("from_address") or "0xSIMULATED_USER",
        "to_address": to_address,
        "function_name": function_name,
        "args": args,
        "value": payload.get("value", 0),
        "token": payload.get("token"),
        "wallet_balance": payload.get("wallet_balance", 0),
        "user_intent": user_intent,
        "initiated_by": payload.get("initiated_by", "user"),
        "attack_simulation": bool(payload.get("attack_simulation", False)),
        "attack_type": attack_type,
        "gas_limit": payload.get("gas_limit"),
    }


def build_decision_context(tx_dict: dict, safe_tx: dict, risk_report: dict, llm_result: dict) -> dict:
    risk_flags = risk_report.get("flags", [])
    risk_message = " ".join([f.get("description", "") for f in risk_flags[:2]]).strip()
    if not risk_message:
        risk_message = "No critical patterns detected."

    ai_intent = llm_result.get("intent_summary") or tx_dict.get("user_intent", "Unknown user intent")
    safe_reason = safe_tx.get("rewrite_reason") or llm_result.get("safe_action", "Review manually")

    return {
        "ai_tried": ai_intent,
        "why_risky": risk_message,
        "agentguard_proposes": safe_reason,
        "human_choice_prompt": "Approve AgentGuard safe transaction or reject this request.",
    }


def _decision_quality(record: dict) -> str:
    status = record.get("status")
    risk_level = record.get("risk_report", {}).get("risk_level", "low")
    if status == "approved" and risk_level in ("critical", "high"):
        return "safe_rewrite_approved"
    if status == "rejected":
        return "dangerous_tx_blocked"
    if status == "approved":
        return "safe_tx_approved"
    return "pending_review"


@router.post("/intercept")
async def intercept_transaction(tx: TransactionRequest):
    # Comprehensive try/except wrapper for all service calls
    try:
        incoming = tx.model_dump(exclude_none=True)
        tx_dict = _normalize_intercept_payload(incoming)

        # Detect risks - has its own fallback
        try:
            risk_report = detect_risks(tx_dict)
        except Exception as e:
            risk_report = {
                "risk_level": "critical",
                "flags": [{"type": "detection_error", "severity": "critical", "description": "Risk detection failed"}],
                "is_safe": False,
                "risk_score": 100,
                "requires_human_review": True,
                "policy_action": "block_and_rewrite",
                "top_threat": "detection_error",
            }

        # LLM analysis - has its own fallback
        try:
            llm_result = analyze_transaction(tx_dict, risk_report, tx_dict.get("user_intent"))
        except Exception as e:
            llm_result = {
                "intent_summary": tx_dict.get("user_intent") or "Unknown",
                "risk_explanation": "AI analysis unavailable",
                "safe_action": "reject",
                "safe_params": {},
            }

        # Rewrite if risky - has its own fallback
        try:
            safe_tx = rewrite_safe(tx_dict, risk_report, llm_result)
        except Exception as e:
            safe_tx = {
                "rewrite_reason": "Rewrite failed - review manually",
                "is_safe_version": False,
            }

        # Build decision context
        try:
            decision_context = build_decision_context(tx_dict, safe_tx, risk_report, llm_result)
        except Exception as e:
            decision_context = {
                "ai_tried": tx_dict.get("user_intent") or "Unknown",
                "why_risky": "Unable to determine",
                "agentguard_proposes": "Review manually",
                "human_choice_prompt": "Approve or reject this transaction.",
            }

        tx_id = str(ObjectId())
        why_risky = decision_context.get("why_risky", "Risk context unavailable")

        record = {
            "_id": tx_id,
            "tx_id": tx_id,
            "tx_type": tx_dict.get("tx_type"),
            "attack_type": tx_dict.get("attack_type"),
            "risk_level": risk_report.get("risk_level"),
            "risk_score": risk_report.get("risk_score"),
            "policy_action": risk_report.get("policy_action"),
            "why_risky": why_risky,
            "safe_tx": safe_tx,
            "ai_tried": decision_context.get("ai_tried"),
            "agentguard_proposes": decision_context.get("agentguard_proposes"),
            "attack_simulation": bool(tx_dict.get("attack_simulation", False)),
            "created_at": firestore.SERVER_TIMESTAMP,
            "original_tx": tx_dict,
            "risk_report": risk_report,
            "llm_analysis": llm_result,
            "decision_context": decision_context,
            "decision": None,
            "status": "pending",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            result = transactions_collection.insert_one(record)
            record["_id"] = str(result.inserted_id)
            record["tx_id"] = str(result.inserted_id)
            print(f"[TRANSACTION] New transaction saved: {record['_id']} to {STORAGE_MODE}")
        except Exception as e:
            print(f"[ERROR] Failed to save transaction: {str(e)[:100]}")
            raise HTTPException(status_code=500, detail="Failed to save transaction to database")

        # Log on-chain - has its own fallback
        try:
            onchain_intercept = log_interception_onchain(
                record["_id"],
                risk_report.get("risk_level", "unknown"),
                llm_result.get("intent_summary", tx_dict.get("user_intent")),
            )
            onchain_rewrite = log_rewrite_onchain(record["_id"], safe_tx.get("rewrite_reason", ""))
        except Exception as e:
            onchain_intercept = {"enabled": False, "recorded": False, "reason": "On-chain logging error"}
            onchain_rewrite = {"enabled": False, "recorded": False, "reason": "On-chain logging error"}

        try:
            transactions_collection.update_one(
                _make_id_query(record["_id"]),
                {
                    "$set": {
                        "onchain.interception": onchain_intercept,
                        "onchain.rewrite": onchain_rewrite,
                    }
                },
            )
        except Exception:
            # Continue even if on-chain logging update fails
            pass

        return {
            "tx_id": record["_id"],
            "original_tx": tx_dict,
            "risk_report": risk_report,
            "risk_score": risk_report.get("risk_score"),
            "risk_level": risk_report.get("risk_level"),
            "llm_analysis": llm_result,
            "safe_tx": safe_tx,
            "decision_context": decision_context,
            "why_risky": why_risky,
            "onchain": {
                "interception": onchain_intercept,
                "rewrite": onchain_rewrite,
            },
            "status": "pending",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        # Catch-all for any unexpected error
        raise HTTPException(status_code=500, detail=f"Unexpected error during transaction interception: {str(e)[:100]}")


@router.post("/approve/{tx_id}")
async def approve_transaction(tx_id: str):
    try:
        doc = transactions_collection.find_one(_make_id_query(tx_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")

    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")

    decision_onchain = log_decision_onchain(tx_id, "approved", "Approved safe transaction")

    try:
        decided_variant = doc.get("safe_tx") or "safe_tx"
        result = transactions_collection.update_one(
            _make_id_query(tx_id),
            {
                "$set": {
                    "decision": "approved",
                    "decided_at": firestore.SERVER_TIMESTAMP,
                    "decided_variant": decided_variant,
                    "status": "approved",
                    "approved_variant": "safe_tx",
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                    "onchain.decision": decision_onchain,
                }
            },
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {
        "tx_id": tx_id,
        "status": "approved",
        "approved_variant": "safe_tx",
        "onchain": {"decision": decision_onchain},
    }


@router.post("/reject/{tx_id}")
async def reject_transaction(tx_id: str, body: ActionRequest = ActionRequest()):
    reject_reason = body.reason or "User rejected risky transaction"
    decision_onchain = log_decision_onchain(tx_id, "rejected", reject_reason)

    try:
        result = transactions_collection.update_one(
            _make_id_query(tx_id),
            {
                "$set": {
                    "decision": "rejected",
                    "decided_at": firestore.SERVER_TIMESTAMP,
                    "decided_variant": "rejected",
                    "status": "rejected",
                    "reject_reason": reject_reason,
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                    "onchain.decision": decision_onchain,
                }
            },
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {
        "tx_id": tx_id,
        "status": "rejected",
        "reason": reject_reason,
        "onchain": {"decision": decision_onchain},
    }


@router.get("/audit")
async def get_audit_log():
    docs = transactions_collection.find().sort("timestamp", -1).limit(20)
    records = [serialize_doc(doc) for doc in docs]
    return {"transactions": records, "count": len(records)}


@router.get("/audit/evidence/{tx_id}")
async def get_audit_evidence(tx_id: str):
    try:
        doc = transactions_collection.find_one(_make_id_query(tx_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")

    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")

    doc = serialize_doc(doc)
    return {
        "tx_id": doc.get("_id"),
        "status": doc.get("status"),
        "quality": _decision_quality(doc),
        "timestamp": doc.get("timestamp"),
        "resolved_at": doc.get("resolved_at"),
        "risk": {
            "level": doc.get("risk_report", {}).get("risk_level"),
            "score": doc.get("risk_report", {}).get("risk_score"),
            "top_threat": doc.get("risk_report", {}).get("top_threat"),
            "flags": doc.get("risk_report", {}).get("flags", []),
        },
        "decision_context": doc.get("decision_context", {}),
        "onchain": doc.get("onchain", {}),
        "proof_summary": {
            "db_recorded": True,
            "onchain_interception_recorded": bool(doc.get("onchain", {}).get("interception", {}).get("recorded")),
            "onchain_rewrite_recorded": bool(doc.get("onchain", {}).get("rewrite", {}).get("recorded")),
            "onchain_decision_recorded": bool(doc.get("onchain", {}).get("decision", {}).get("recorded")),
        },
    }


@router.get("/judge/scorecard")
async def judge_scorecard():
    docs = list(transactions_collection.find())
    total = len(docs)
    approved = sum(1 for d in docs if d.get("decision") == "approved")
    rejected = sum(1 for d in docs if d.get("decision") == "rejected")
    pending = total - approved - rejected
    rewrites = sum(1 for d in docs if d.get("safe_tx") is not None)
    human_decisions = approved + rejected

    critical_or_high = sum(
        1
        for d in docs
        if (d.get("risk_level") or d.get("risk_report", {}).get("risk_level")) in ("critical", "high")
    )

    avg_risk_score = (
        round(
            sum(
                d.get("risk_score")
                if d.get("risk_score") is not None
                else d.get("risk_report", {}).get("risk_score", 0)
                for d in docs
            ) / total,
            2,
        )
        if total
        else 0
    )

    return {
        "project": "AgentGuard",
        "attacks_intercepted": total,
        "rewrites_generated": rewrites,
        "human_decisions": human_decisions,
        "total_intercepted": total,
        "total_approvals": approved,
        "total_rejections": rejected,
        "total_pending": pending,
        "total_rewrites": rewrites,
        "total_on_chain": 0,
        "requestly_total": 0,
        "requestly_passed": 0,
        "high_or_critical_detected": critical_or_high,
        "protected_outcomes": human_decisions,
        "average_risk_score": avg_risk_score,
        "summary": {
            "total_interceptions": total,
            "approved": approved,
            "rejected": rejected,
            "pending": pending,
            "high_or_critical_detected": critical_or_high,
            "protected_outcomes": human_decisions,
            "average_risk_score": avg_risk_score,
        },
        "tamper_proof_audit": {
            "onchain_interception_records": 0,
            "onchain_decision_records": 0,
        },
        "judge_notes": [
            "Human-in-the-loop approval enforced before execution",
            "Dangerous transactions are blocked or rewritten to safe alternatives",
            "All decisions are auditable in Firestore",
        ],
    }
