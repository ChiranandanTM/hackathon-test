@echo off
REM AgentGuard - One-Click Startup Script for Windows
REM This script starts both backend and frontend services

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║              AgentGuard - Quick Start              ║
echo ║   AI-Powered Blockchain Transaction Security      ║
echo ╚════════════════════════════════════════════════════╝
echo.

setlocal enabledelayedexpansion

REM Get the project root directory
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo ✓ Project root: %PROJECT_ROOT%

REM Check if node_modules exist
if not exist "frontend\node_modules" (
    echo.
    echo ⚠ Frontend dependencies not installed. Installing now...
    cd frontend
    call npm install
    cd ..
    echo ✓ Frontend dependencies installed
)

REM Create .env files if they don't exist
if not exist "backend\.env" (
    echo.
    echo ℹ Creating backend/.env...
    (
        echo # MongoDB Configuration
        echo MONGODB_URI=mongodb://localhost:27017/agentguard
        echo # Anthropic API Key (optional
        echo ANTHROPIC_API_KEY=
        echo # Server Configuration
        echo PORT=8000
        echo ENVIRONMENT=development
    ) > backend\.env
    echo ✓ Created backend/.env
)

if not exist "frontend\.env" (
    echo.
    echo ℹ Creating frontend/.env...
    (
        echo # Frontend Configuration
        echo VITE_API_URL=http://localhost:8000
    ) > frontend\.env
    echo ✓ Created frontend/.env
)

echo.
echo ═══════════════════════════════════════════════════════
echo.
echo Ready to start services! Two new windows will open...
echo.
echo BACKEND:  http://localhost:8000
echo FRONTEND: http://localhost:5173
echo.
echo ═══════════════════════════════════════════════════════
echo.
pause

REM Open backend in new window
echo Starting backend server...
start "AgentGuard - Backend (FastAPI)" cmd /k "cd %PROJECT_ROOT%backend && ..\\.venv\\Scripts\\python -m uvicorn main:app --reload --port 8000"

timeout /t 2 /nobreak

REM Open frontend in new window
echo Starting frontend server...
start "AgentGuard - Frontend (React + Vite)" cmd /k "cd %PROJECT_ROOT%frontend && npm run dev"

echo.
echo ✓ Both services started!
echo.
echo Next steps:
echo 1. Wait 10 seconds for services to initialize
echo 2. Frontend: http://localhost:5173
echo 3. Backend API: http://localhost:8000
echo 4. API Docs: http://localhost:8000/docs
echo.
echo To stop services, close the command windows or press Ctrl+C
echo.

endlocal
pause
