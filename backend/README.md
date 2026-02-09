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

## Database
SQLite path is configured via `DB_PATH` (defaults to `mage.db` in `backend/`).

### Migrations
- `alembic upgrade head`

## Health
- `GET /health` returns `{ "status": "ok" }`

## Status
- `GET /status` returns uptime, env, and stubbed operational metrics
