# MAGE
Local-first AI productivity system.

## Structure
- `backend/` FastAPI service
- `frontend/` Tauri-ready React app (Vite)
- `shell/` helper scripts

## Health checks
- Backend: `GET http://127.0.0.1:8000/health`
- Status: `GET http://127.0.0.1:8000/status`
- Frontend: displays backend health in UI (see `frontend/src/App.tsx`)

## Quick start
1. Backend: `./shell/dev-backend.sh`
2. Frontend: `./shell/dev-frontend.sh`
3. Health check: `./shell/healthcheck.sh`

## Configuration
- Backend settings live in `backend/.env` (copy from `backend/.env.example`)
