# MAGE Backend

## Run locally
1. Create a virtualenv and install deps:
   - `python -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
2. Start server:
   - `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`

## Configuration
Settings are loaded from `.env` in `backend/` (see `.env.example`).

### LLM settings
- `LLM_DEFAULT_PROVIDER=local`
- `LOCAL_LLM_BASE_URL` (optional)
- `LOCAL_LLM_MODEL` (default `gemma`)
- `LOCAL_LLM_TIMEOUT_S` (seconds)

### Notification settings (Ntfy)
- `NOTIFY_PROVIDER=ntfy|off` (default `off`)
- `NTFY_URL` (default `https://ntfy.sh`)
- `NTFY_TOPIC` (required when provider is `ntfy`)

## Database
SQLite path is configured via `DB_PATH` (defaults to `mage.db` in `backend/`).

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

## Alerts
- `POST /alerts/test` sends a test notification (allowed to send)

## Student Ops
- `POST /ingest/assignment` stores a manual assignment and returns urgency bucket
