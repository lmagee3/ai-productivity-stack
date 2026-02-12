# module_09
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
5. All-in-one: `./shell/dev-all.sh`
6. One-command desktop run (backend + tauri): `./shell/dev-one.sh`

## Makefile
- `make setup`
- `make dev`
- `make all`
- `make one`
- `make backend`
- `make frontend`
- `make health`
- `make verify`
- `make verify-offline`
- `make down`
- `make status`

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

## Phase 3 Connectors
- `POST /ingest/email` for read-only email content ingestion (manual payload)
- `POST /ingest/email/fetch` for read-only IMAP mailbox fetch (explicit opt-in)
- `POST /ingest/web` for bounded web ingestion (single URL, no crawler)
- `GET /news/headlines` for hourly-updated headline feed (with fallback if offline)

## Hybrid Brain Routing
- `LOCAL_FAST_MODEL` handles lightweight routing/extraction (`gemma:latest` default)
- `LOCAL_DEEP_MODEL` handles complex reasoning (`gpt-oss:20b` default)
- Cloud fallback is recommendation-only by default and requires approval:
  - `CLOUD_FALLBACK_PROVIDER=gpt`
  - `CLOUD_APPROVAL_REQUIRED=true`

## Ops Summary
- `GET /ops/summary` for a single-screen operational snapshot
- `GET /ops/next` for the next-best action

## Curl Examples
```bash
curl http://127.0.0.1:8000/health -H "X-API-Key: YOUR_API_KEY"
```
```bash
curl http://127.0.0.1:8000/status -H "X-API-Key: YOUR_API_KEY"
```
```bash
curl http://127.0.0.1:8000/ops/summary -H "X-API-Key: YOUR_API_KEY"
```
```bash
curl http://127.0.0.1:8000/ops/next -H "X-API-Key: YOUR_API_KEY"
```
```bash
curl -X POST http://127.0.0.1:8000/brain/dispatch \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"content":"Review CS101 assignment due Friday."}'
```
```bash
curl -X POST http://127.0.0.1:8000/ingest/assignment \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"title":"Essay draft","due_date":"2026-02-12T17:00:00Z","course":"ENG200","url":"https://example.com"}'
```
```bash
curl -X POST http://127.0.0.1:8000/alerts/test \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"title":"Test Alert","message":"Notifications online","click_url":"https://ntfy.sh"}'
```
```bash
curl -X POST http://127.0.0.1:8000/chat/message \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"message":"Give me a status summary and create a task."}'
```
```bash
curl -X POST http://127.0.0.1:8000/actions/execute \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"tool_run_id":1,"approved":true}'
```
```bash
curl -X POST http://127.0.0.1:8000/brain/chat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"message":"What is my next best action?"}'
```
```bash
curl http://127.0.0.1:8000/brain/providers -H "X-API-Key: YOUR_API_KEY"
```
```bash
curl -X POST http://127.0.0.1:8000/brain/recommend \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"message":"Summarize my current status","project":"module_09"}'
```
```bash
curl -X POST http://127.0.0.1:8000/tools/files/scan \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"mode":"scoped","paths":["~/Documents/School","~/Desktop/module_09"],"options":{"include_exts":["pdf","docx","md","txt","pptx","xlsx","py","js","ts","tsx"],"exclude_dirs":["node_modules",".git",".venv","dist","build","__pycache__"],"max_file_mb":2,"read_text":true,"max_chars":12000}}'
```
```bash
curl -X POST http://127.0.0.1:8000/ingest/email \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"subject":"CS101 Week 7 Discussion Due","from_email":"prof@example.edu","body":"Please submit discussion post by 2026-02-12.","url":"https://example.edu/course"}'
```
```bash
curl -X POST http://127.0.0.1:8000/ingest/web \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"url":"https://example.edu/assignment"}'
```
```bash
curl -X POST http://127.0.0.1:8000/ingest/email/fetch \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"limit":5,"mailbox":"INBOX"}'
```
```bash
curl http://127.0.0.1:8000/news/headlines -H "X-API-Key: YOUR_API_KEY"
```

## Configuration
- Backend settings live in `backend/.env` (copy from `backend/.env.example`)
- File scan permissions: add `ALLOWED_SCAN_ROOTS` in `backend/.env` (default: `~/Desktop,~/Documents`).
- Email read connector (optional, read-only):
  - `EMAIL_READ_ENABLED=true`
  - `EMAIL_IMAP_HOST=imap.gmail.com` (example)
  - `EMAIL_IMAP_PORT=993`
  - `EMAIL_IMAP_USER=you@example.com`
  - `EMAIL_IMAP_PASSWORD=<app-password>`
  - `EMAIL_IMAP_MAILBOX=INBOX`
  - Optional relevance filters:
    - `EMAIL_ALLOWLIST_DOMAINS=school.edu,company.com`
    - `EMAIL_DENYLIST_SENDERS=noreply@accounts.google.com,notify-noreply@google.com`
    - `EMAIL_DENYLIST_SUBJECTS=security alert,new jobs for`
- Frontend settings live in `frontend/.env` (copy from `frontend/.env.example`)

## Desktop (Tauri)
Requirements:
- Rust toolchain (`rustup`, `cargo`)
- Tauri CLI (`cargo install tauri-cli`)
If `cargo` is not on your PATH, run `source "$HOME/.cargo/env"`.

Run:
1. Backend: `./shell/dev-backend.sh`
2. Desktop app: `cd frontend && npm install && npm run tauri:dev`
