import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.transactions import router as tx_router
from app.routes.requestly_workflow import router as requestly_workflow_router
from app.database import initialize_database


def _build_allowed_origins() -> list[str]:
    """Return local and production origins, with optional env override."""
    base_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "https://hackathon-hack-1.web.app",
        "https://hackathon-hack-1.firebaseapp.com",
    ]

    frontend_origin = os.getenv("FRONTEND_ORIGIN", "").strip()
    if frontend_origin:
        base_origins.append(frontend_origin)

    # Preserve order while deduplicating.
    return list(dict.fromkeys(base_origins))

app = FastAPI(
    title="AgentGuard API",
    description="AI-powered blockchain transaction security",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    # Keep local dev origins and include Firebase Hosting domains for production.
    allow_origins=_build_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    print("\n" + "="*60)
    print("[SHIELD] AgentGuard API - Starting Up")
    print("="*60)
    initialize_database()
    print("[OK] API ready to receive requests")
    print(f"[DOCS] API Docs: http://localhost:8000/docs")
    print(f"[SERVER] Backend: http://localhost:8000")
    print("="*60 + "\n")

app.include_router(tx_router)
app.include_router(requestly_workflow_router)


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "AgentGuard API",
        "version": "1.0.0",
        "tracks": ["ETHIndia Ethereum Track", "Requestly Track"],
    }


@app.get("/requestly/status")
def requestly_status():
    """
    REQUESTLY TRACK: Endpoint Validation
    Returns service status for staging/production validation
    """
    return {
        "status": "online",
        "service": "AgentGuard API - Requestly Integration",
        "features": [
            "Complex Request Construction (Multi-auth schemes)",
            "Endpoint Validation (Schema verification)",
            "Pre/Post-Response Scripts (Testing & assertions)",
            "Request History & Workspace Export (Collaboration)",
        ],
        "endpoints": {
            "intercept": "POST /intercept - Analyze transaction risks",
            "approve": "POST /approve/{tx_id} - Approve transaction",
            "reject": "POST /reject/{tx_id} - Reject transaction",
            "audit": "GET /audit - Get transaction audit log",
            "audit_evidence": "GET /audit/evidence/{tx_id} - Get per-transaction proof package",
            "judge_scorecard": "GET /judge/scorecard - Get demo metrics and impact summary",
        },
    }


@app.get("/requestly/documentation")
def requestly_documentation():
    """
    REQUESTLY TRACK: API Documentation
    Provides comprehensive API documentation for Requestly API Client
    """
    return {
        "title": "AgentGuard API - Requestly Integration",
        "version": "1.0.0",
        "description": "Sophisticated API Client demonstrating Requestly best practices",
        "tracks": {
            "ethereum": {
                "name": "ETHIndia Ethereum Track",
                "focus": "Building on Ethereum blockchain",
                "implementation": [
                    "Smart contracts (GuardianProxy, MockUSDC)",
                    "Ethereum transaction analysis",
                    "On-chain execution",
                    "Cross-contract interaction",
                ],
            },
            "requestly": {
                "name": "Requestly API Client Track",
                "focus": "Professional-grade API interaction",
                "implementation": [
                    "Complex Request Construction",
                    "Multiple authentication schemes (Bearer, API Key, HMAC)",
                    "Endpoint Validation & Schema Verification",
                    "Pre/Post-Response Scripts",
                    "Request history & workspace collaboration",
                ],
            },
        },
        "api_reference": {
            "intercept": {
                "method": "POST",
                "endpoint": "/intercept",
                "description": "Analyze transaction for risks and suggest safe alternatives",
                "auth": "Bearer or HMAC signature",
                "request_schema": {
                    "from_address": "string (required)",
                    "to_address": "string (required)",
                    "function_name": "string (required)",
                    "args": "object (required)",
                    "value": "number (optional)",
                    "wallet_balance": "number (optional)",
                },
            },
            "approve": {
                "method": "POST",
                "endpoint": "/approve/{tx_id}",
                "description": "Approve a pending transaction",
                "parameters": {"tx_id": "string (required)"},
            },
        },
    }


@app.get("/judge/requestly-proof")
def judge_requestly_proof():
    """
    Judge-facing concise proof that Requestly API Client track requirements are met.
    """
    return {
        "track": "Requestly API Client",
        "qualification": "advanced",
        "core_focus_areas": {
            "complex_request_construction": {
                "status": "implemented",
                "details": [
                    "Multi-part payload handling for /intercept",
                    "Multiple auth schemes: none, bearer, api_key, hmac",
                    "Pre-request enrichment and validation scripts",
                ],
                "endpoint": "/requestly/workflow/complex-request",
            },
            "endpoint_validation": {
                "status": "implemented",
                "details": [
                    "Staging validation for health, intercept, and audit endpoints",
                    "Expected status checks with pass/fail summary",
                    "Schema-oriented response verification",
                ],
                "endpoint": "/requestly/workflow/validate",
            },
            "testing_scripts": {
                "status": "implemented",
                "details": [
                    "Pre-request scripts for metadata and header injection",
                    "Post-response scripts for response validation",
                    "Automated workflow tests executable via API",
                ],
                "endpoint": "/requestly/workflow/run-tests",
            },
            "workspace_collaboration": {
                "status": "implemented",
                "details": [
                    "Local workspace JSON export",
                    "Git-friendly artifact for collaboration",
                    "Replayable request/response history for team review",
                ],
                "endpoint": "/requestly/workflow/export-workspace",
            },
        },
        "demo_sequence": [
            "Call /requestly/workflow/validate",
            "Call /requestly/workflow/run-tests",
            "Call /requestly/workflow/export-workspace",
            "Show generated workspace file in requestly_workspaces/",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)

