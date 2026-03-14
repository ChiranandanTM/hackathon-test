# AgentGuard System Documentation

## 1) Project Purpose
AgentGuard is a Web3 security demo platform that intercepts risky blockchain transaction intent before execution, explains risk with AI, proposes a safer alternative, requires human decision, and records evidence for audit/judging.

The project combines:
- Frontend UX for live attack simulation and analyst actions.
- FastAPI backend for interception, risk analysis, and decision endpoints.
- Firestore for realtime persistence and live UI synchronization.
- Hardhat contracts for blockchain demo execution (local or Sepolia).
- Requestly workflow endpoints for API-client track demonstrations.

## 2) High-Level Architecture

### Frontend (React + Vite + Tailwind)
Path: `frontend/`

Main responsibilities:
- Live demo UI and scenario simulation.
- Calls backend APIs (`/intercept`, `/approve/{id}`, `/reject/{id}`, etc).
- Subscribes to Firestore collections (`intercepts`, `simulation_events`) for realtime updates.
- Displays evidence and audit timeline.

Key files:
- `frontend/src/App.jsx`: app shell, splash flow, tabs, realtime subscriptions.
- `frontend/src/components/LiveAttackDemo.tsx`: cinematic heist flow and on-chain demo execution.
- `frontend/src/components/DemoScenarios.jsx`: simulation attack scenarios.
- `frontend/src/components/AuditLog.jsx`: live audit feed from Firestore `intercepts`.
- `frontend/src/utils/api.js`: backend API calls with Firestore fallback logic.
- `frontend/src/agentguard.config.js`: RPC, explorer, contract, wallet, ABI config.

### Backend (FastAPI)
Path: `backend/`

Main responsibilities:
- Intercept and analyze transaction requests.
- Compute risk report and safer rewrite suggestions.
- Persist transaction lifecycle and decisions.
- Provide Requestly workflow proof endpoints.

Key files:
- `backend/main.py`: FastAPI app setup, CORS, router registration, health/docs endpoints.
- `backend/app/routes/transactions.py`: `/intercept`, `/approve/{tx_id}`, `/reject/{tx_id}`, `/audit`, audit evidence/scorecard.
- `backend/app/routes/requestly_workflow.py`: request construction/validation/testing/export workflow.
- `backend/app/database.py`: Firestore-first storage with filesystem fallback wrapper.

### Smart Contracts (Hardhat)
Path: `contracts/`

Main responsibilities:
- Compile/deploy demo contracts.
- Provide local and Sepolia deployment flows.

Key files:
- `contracts/contracts/GuardianProxy.sol`
- `contracts/contracts/MockUSDC.sol`
- `contracts/scripts/deploy.js`
- `contracts/package.json` scripts (`node`, `compile`, `deploy`, `deploy:local`, `test`)

### Data Layer
- Primary: Firebase Firestore collections (`intercepts`, `simulation_events`).
- Backend fallback: local file storage via `FileBasedCollection` if Firebase unavailable.

## 3) End-to-End Working Flow

### A) Standard Security Decision Flow
1. User or simulation submits transaction payload to backend `/intercept`.
2. Backend normalizes payload and runs:
   - Risk detection (`risk_detector`)
   - LLM analysis (`llm_service`)
   - Safe rewrite generation (`tx_rewriter`)
3. Backend writes a pending record in `intercepts` with risk metadata and decision context.
4. Frontend receives live updates via Firestore snapshot listeners.
5. Human (user/analyst) approves or rejects:
   - `POST /approve/{tx_id}`
   - `POST /reject/{tx_id}`
6. Backend updates decision fields and on-chain audit metadata.
7. Audit log and evidence views render the final record.

### B) Live Attack Demo Flow
1. User clicks `Release the Heist` in `LiveAttackDemo`.
2. Component advances state machine:
   - `scene` and `attackPhase` transitions with timed animation.
3. Attack execution path:
   - If demo contracts configured: execute contract-based path.
   - If not configured: execute fallback direct tx path for a valid tx hash.
4. AI intercept analysis is requested from backend (`interceptTransaction`).
5. If backend response lacks `tx_id` or backend fails, frontend writes fallback audit-like intercept document to Firestore so `AuditLog` still updates.
6. Scene 4 displays hashes, explorer links, and AI summary.

### C) Realtime Simulation Events
1. Frontend emits events to `simulation_events` collection.
2. Other role clients subscribe and react (attacker/user role handoff).
3. Alerts and prompts are shown via notifications/modals.

## 4) API Surface (Core)

### Transaction Security
- `POST /intercept`
- `POST /approve/{tx_id}`
- `POST /reject/{tx_id}`
- `GET /audit`
- `GET /audit/evidence/{tx_id}`
- `GET /judge/scorecard`

### Requestly Workflow
- `GET /requestly/workflow/overview`
- `POST /requestly/workflow/complex-request`
- `GET /requestly/workflow/validate`
- `GET /requestly/workflow/run-tests`
- `POST /requestly/workflow/export-workspace`

## 5) Firestore Collections Used

### `intercepts`
Stores transaction lifecycle records:
- risk fields: `risk_level`, `risk_score`, `why_risky`
- decision fields: `decision`, `status`, `decided_at`, `resolved_at`
- context fields: `original_tx`, `decision_context`, `safe_tx`, `llm_analysis`
- metadata: `created_at`, `timestamp`, `onchain.*`

### `simulation_events`
Stores cross-role realtime signals:
- `type` (for example: `user_transaction_started`, `attacker_attack_started`)
- `payload`
- `source_role`, `source_client_id`
- `created_at`

## 6) Runtime and Startup

### Frontend
From `frontend/`:
- `npm run dev`
- `npm run build`
- `npm run preview`

### Backend
From `backend/`:
- `python main.py` (works with current setup)
- `python -m uvicorn main:app --reload --port 8000` (environment-dependent in current machine history)

### Contracts
From `contracts/`:
- `npm run node`
- `npm run compile`
- `npm run deploy:local`
- `npm run deploy`

### One-click launcher
- `START.bat` starts backend/frontend windows.
- Note: `START.bat` includes older MongoDB env placeholders, while current backend storage is Firestore-first.

## 7) Configuration Notes

### Frontend config
- `frontend/src/agentguard.config.js`
  - `rpcUrl`, `chainId`, `explorerBaseUrl`
  - contract addresses
  - demo wallet addresses/keys
  - token decimals and demo amounts

### Backend/CORS
- `backend/main.py` allows localhost and Firebase-hosted frontend origins.
- Optional env override: `FRONTEND_ORIGIN`.

## 8) Failure Handling Strategy
- Backend unavailable: frontend API utility falls back to Firestore writes (`interceptFallback`, `decisionFallback`).
- Missing contract config in live demo: fallback transfer path prevents hard crash.
- On-chain audit logging failures do not block API response path.

## 9) What Judges/Reviewers Should Observe
1. Trigger simulated or live attack.
2. Verify intercept and risk explanation appears.
3. Approve or reject safe path.
4. Open Audit Log and Evidence to confirm persisted trail.
5. Inspect Requestly workflow endpoints for API-client track proof.

---
This document reflects the current integrated project flow across frontend, backend, Firestore, and contract demo components.
