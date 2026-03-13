# AgentGuard - Full Project Documentation

## Overview
AgentGuard is an AI-assisted blockchain transaction firewall. It intercepts high-risk wallet actions, explains the risk, rewrites safer alternatives, requires human approval, and records evidence for audit and demo scoring.

## Core Problem
- AI agents can execute irreversible on-chain actions.
- Users often cannot inspect raw calldata safely.
- Existing wallet prompts are not enough for autonomous execution workflows.

## Core Solution Flow
1. Frontend sends a candidate transaction to backend `/intercept`.
2. Backend risk engine classifies attack patterns.
3. LLM layer explains intent/risk and proposes safer action.
4. Rewriter generates a constrained safe transaction.
5. Human approves or rejects via `/approve/{tx_id}` or `/reject/{tx_id}`.
6. Full record is stored in database and optionally on-chain.

## Project Structure
```
hackathon-test-main/
  backend/
    main.py
    requirements.txt
    app/
      database.py
      routes/
        transactions.py
        requestly_workflow.py
      services/
        risk_detector.py
        llm_service.py
        tx_rewriter.py
        blockchain_audit.py
        requestly_client.py
        requestly_tests.py
  frontend/
    index.html
    package.json
    src/
      App.jsx
      config.js
      main.jsx
      firebase.js
      components/
      utils/
  contracts/
    hardhat.config.js
    contracts/
      GuardianProxy.sol
      MockUSDC.sol
    scripts/
      deploy.js
      verify.js
  functions/
    main.py
    requirements.txt
  firebase.json
  .firebaserc
  START.bat
```

## Backend
### Framework
- FastAPI application in `backend/main.py`.
- CORS enabled for local frontend and Firebase hosting domains.

### Main API Endpoints
- `GET /` health check.
- `POST /intercept` analyze transaction risk and return safe alternative.
- `POST /approve/{tx_id}` approve the safe transaction.
- `POST /reject/{tx_id}` reject with reason.
- `GET /audit` fetch audit history.
- `GET /audit/evidence/{tx_id}` fetch detailed evidence package.
- `GET /judge/scorecard` demo metrics and impact summary.
- Requestly workflow routes under `/requestly/workflow/*`.

### Services
- `risk_detector.py`: detects patterns like infinite approvals and drain-like transfers.
- `llm_service.py`: AI narrative and intent/risk explanation with fallback behavior.
- `tx_rewriter.py`: creates safer bounded transaction alternatives.
- `blockchain_audit.py`: optional on-chain logging via Web3 and GuardianProxy ABI.
- `requestly_client.py` and `requestly_tests.py`: Requestly track workflows and testable API automation.

### Data Layer
- `database.py` uses MongoDB when available.
- If MongoDB is unavailable, falls back to JSON file persistence.
- Storage mode is auto-selected at startup.

## Frontend
### Stack
- React + Vite + Tailwind.
- API base centralized in `frontend/src/config.js`.
- Firebase app initialization in `frontend/src/firebase.js`.

### Key UI Areas
- Demo scenarios for attack simulation.
- Threat/audit visualization panels.
- Evidence and scorecard views for judge/demo flow.
- Requestly integration visualizer.

### API Integration
- Client methods use shared `apiCall()` wrapper for timeout and error handling.
- Production API URL controlled by `frontend/.env.production`.

## Smart Contracts
### `GuardianProxy.sol`
- Logs interception, rewrite, and decision events.
- Provides immutable, searchable audit trail on Ethereum.

### `MockUSDC.sol`
- ERC20 mock token used for approval/drain simulation demos.

### Hardhat Scripts
- `scripts/deploy.js`: deploy contracts.
- `scripts/verify.js`: verification/testing support.

## Firebase Setup (Current)
### Hosting
- Frontend hosted on Firebase Hosting.
- `firebase.json` serves `frontend/dist`.

### Functions
- `functions/main.py` wraps FastAPI via `a2wsgi` as Firebase HTTPS function `api`.
- Hosting rewrite maps `/api/**` to function `api`.

### Important Deployment Note
- Deploying Firebase Functions requires Blaze plan and API permissions for Cloud Build and Artifact Registry.
- If Functions are not deployed, `/api/*` returns 404 from Hosting rewrite target.

## Local Development
### Backend
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### URLs
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

## Build and Deploy
### Frontend Build
```bash
cd frontend
npm run build
```

### Firebase Hosting Deploy
```bash
firebase deploy --only hosting --project hackathon-hack-1
```

### Firebase Functions + Hosting Deploy
```bash
firebase deploy --only "functions,hosting" --project hackathon-hack-1
```

## Environment Variables
### Backend (.env)
- `MONGODB_URI`
- `ANTHROPIC_API_KEY` (optional)
- `ETH_RPC_URL` (optional for on-chain logging)
- `ETH_PRIVATE_KEY` (optional)
- `GUARDIAN_PROXY_ADDRESS` (optional)
- `DATA_STORAGE_DIR` (optional filesystem fallback path)

### Frontend
- `VITE_API_URL`
- `VITE_ENV`

## Current Known Constraints
- Firebase Functions deployment can fail if project is not on Blaze plan.
- Without deployed function `api`, production `/api/*` calls return 404.
- Local backend remains fully functional and can be used for end-to-end demos.

## Quick Verification Checklist
1. Backend starts without import errors.
2. `GET /` returns healthy JSON.
3. `/intercept` returns risk report for demo payload.
4. Frontend can load audit/scorecard with configured `VITE_API_URL`.
5. Hosting serves `frontend/dist` after build.

## Summary
AgentGuard is an end-to-end transaction safety layer combining risk detection, AI interpretation, safe rewriting, human control, and auditable records, with local-first reliability and optional blockchain-backed proofing.