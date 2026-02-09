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
4. Migrations: `cd backend && alembic upgrade head`

## Makefile
- `make dev`
- `make backend`
- `make frontend`
- `make health`

## Local Dev Verification
Date: 2026-02-09
- Backend: `./shell/dev-backend.sh`
  - Failed: pip could not download dependencies (network unavailable). Error: `No matching distribution found for fastapi==0.111.0`.
- Frontend (Tauri): `cd frontend && npm run tauri:dev`
  - Failed: `vite: command not found` because `npm install` could not complete (network unavailable).

## Configuration
- Backend settings live in `backend/.env` (copy from `backend/.env.example`)
- Frontend settings live in `frontend/.env` (copy from `frontend/.env.example`)

## Desktop (Tauri)
Requirements:
- Rust toolchain (`rustup`, `cargo`)
- Tauri CLI (`cargo install tauri-cli`)
If `cargo` is not on your PATH, run `source "$HOME/.cargo/env"`.

Run:
1. Backend: `./shell/dev-backend.sh`
2. Desktop app: `cd frontend && npm install && npm run tauri:dev`
