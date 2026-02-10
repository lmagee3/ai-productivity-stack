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
- `make setup`
- `make dev`
- `make backend`
- `make frontend`
- `make health`
- `make verify`
- `make verify-offline`

## Local Dev Verification
Date: 2026-02-09
- Backend: `./shell/dev-backend.sh`
  - Failed: pip could not download dependencies (network unavailable). Error: `No matching distribution found for fastapi==0.111.0`.
- Frontend (Tauri): `cd frontend && npm run tauri:dev`
  - Failed: `vite: command not found` because `npm install` could not complete (network unavailable).

## Offline-friendly Verification
- `make verify` or `make verify-offline` checks Python and Node, creates the backend venv, and reports missing `node_modules` without failing.
- For online installs: `./shell/verify.sh --online`

## Dependency Locking (Optional)
- If you want locked Python deps, use `pip-tools` or `uv` to generate a `requirements.lock` and install from it.

## Student Ops v1.1
- `POST /ingest/assignment` for manual task intake
- `POST /alerts/test` for Ntfy notification testing

## Ops Summary
- `GET /ops/summary` for a single-screen operational snapshot
- `GET /ops/next` for the next-best action

## Curl Examples
```bash
curl http://127.0.0.1:8000/health
```
```bash
curl http://127.0.0.1:8000/status
```
```bash
curl http://127.0.0.1:8000/ops/summary
```
```bash
curl http://127.0.0.1:8000/ops/next
```
```bash
curl -X POST http://127.0.0.1:8000/brain/dispatch \\
  -H "Content-Type: application/json" \\
  -d '{"content":"Review CS101 assignment due Friday."}'
```
```bash
curl -X POST http://127.0.0.1:8000/ingest/assignment \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Essay draft","due_date":"2026-02-12T17:00:00Z","course":"ENG200","url":"https://example.com"}'
```
```bash
curl -X POST http://127.0.0.1:8000/alerts/test \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Test Alert","message":"Notifications online","click_url":"https://ntfy.sh"}'
```
```bash
curl -X POST http://127.0.0.1:8000/chat/message \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Give me a status summary and create a task."}'
```
```bash
curl -X POST http://127.0.0.1:8000/actions/execute \\
  -H "Content-Type: application/json" \\
  -d '{"tool_run_id":1,"approved":true}'
```
```bash
curl -X POST http://127.0.0.1:8000/brain/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message":"What is my next best action?"}'
```
```bash
curl http://127.0.0.1:8000/brain/providers
```
```bash
curl -X POST http://127.0.0.1:8000/brain/recommend \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Summarize my current status","project":"mage"}'
```

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
