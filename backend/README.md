# module_09 Backend

## Run locally
1. Create a virtualenv and install deps:
   - `python -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
2. Start server:
   - `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`

## Configuration
Settings are loaded from `.env` in `backend/` (see `.env.example`).
Add `API_KEY` in `.env` and send requests with `X-API-Key`.

### LLM settings
- `LLM_DEFAULT_PROVIDER=local`
- `LOCAL_LLM_BASE_URL` (optional)
- `LOCAL_LLM_MODEL` (default `gemma`)
- `LOCAL_LLM_TIMEOUT_S` (seconds)
- `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `OLLAMA_MODEL` (default `gemma`)

### Notification settings (Ntfy)
- `NOTIFY_PROVIDER=ntfy|off` (default `off`)
- `NTFY_URL` (default `https://ntfy.sh`)
- `NTFY_TOPIC` (required when provider is `ntfy`)

## Database
SQLite path is configured via `DB_PATH` (defaults to `module_09.db` in `backend/`).

### Migrations
- `alembic upgrade head`

## Health
- `GET /health` returns `{ "status": "ok" }`

## Status
- `GET /status` returns uptime, env, and stubbed operational metrics

## Brain
- `POST /brain/dispatch` returns a strict dispatcher decision JSON
- `POST /email/draft` returns a draft only (no send)
- `POST /notion/patch` returns a proposed patch only (no write)

## Ops
- `GET /ops/summary` returns an aggregated operational snapshot
- `GET /ops/next` returns the next best action plus alternates

## Alerts
- `POST /alerts/test` sends a test notification (allowed to send)

## Student Ops
- `POST /ingest/assignment` stores a manual assignment and returns urgency bucket

## Chat
- `POST /chat/message` sends a message and returns proposed actions
- `POST /actions/execute` executes approved actions only

## Brain Chat
- `POST /brain/chat` routes intent, gathers context, and logs decisions (approval-first)
- `GET /brain/providers` lists registered LLM providers
- `POST /brain/recommend` returns a rule-based provider recommendation

## Tools
- `POST /tools/files/scan` scans files (read-only, scoped)
