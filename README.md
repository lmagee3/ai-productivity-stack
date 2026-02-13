# module_09 — MAGE Productivity OS

Multi-Agent Generative Engine. Desktop productivity system built on Tauri + React + FastAPI + SQLite.

---

## Architecture

- **Frontend**: React + TypeScript + Vite (Tauri webview)
- **Shell**: Tauri (Rust) for native desktop integration
- **Backend**: FastAPI (Python) + SQLAlchemy + SQLite
- **AI**: Local LLM via Ollama (Gemma), cloud fallback (configurable)
- **Scheduler**: Threading-based automation runtime (4-hour intervals)

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node 18+
- Rust + Tauri CLI
- Ollama (optional, for local LLM)

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy .env.example to .env and configure
cp .env.example .env
# Edit .env: set API_KEY, NOTION_TOKEN (if using Notion integration)

# Run migrations
python -m alembic upgrade head

# Start backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Health check:**
```bash
curl http://127.0.0.1:8000/health -H "X-API-Key: MAGE-local-v.1"
# → {"status":"ok","db":"connected"}
```

### 2. Frontend Setup
```bash
cd frontend
npm install

# Development mode (Tauri desktop app)
npm run tauri dev

# OR web-only dev server
npm run dev
```

---

## Environment Variables

See `backend/.env.example` for full list. Key vars:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | Yes | `MAGE-local-v.1` | Backend API authentication |
| `NOTION_TOKEN` | No | — | Notion integration token (create at notion.so/my-integrations) |
| `NOTION_PROD_DB_ID` | No | (hardcoded) | Productivity Dashboard database ID |
| `NOTION_EMAIL_DB_ID` | No | (hardcoded) | Email Action Items database ID |
| `LLM_DEFAULT_PROVIDER` | No | `local` | `local` (Ollama) or `gpt` |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL |
| `BRAIN_EXECUTION_MODE` | No | `assist` | `assist` (ask before actions) or `auto` |

---

## API Endpoints

### Core
- `GET /health` — Health check
- `GET /status` — System status + runtime state
- `GET /ops/summary` — Task summary (overdue, due soon, total)
- `GET /ops/next` — Next actionable task

### Notion Integration
- `POST /notion/sync` — Manually trigger Notion sync
- `GET /notion/tasks` — Query synced tasks (filters: `status`, `domain`, `priority`, `source_db`)

**Example:**
```bash
# Sync Notion databases
curl -X POST http://127.0.0.1:8000/notion/sync \
  -H "X-API-Key: MAGE-local-v.1"

# Get high-priority Kairos tasks
curl "http://127.0.0.1:8000/notion/tasks?domain=Kairos&priority=high" \
  -H "X-API-Key: MAGE-local-v.1"
```

### Chat
- `POST /chat` — Send message to AI assistant
- `POST /brain/chat` — Advanced brain routing (tool execution)

### Runtime
- `POST /runtime/trigger` — Manually trigger scheduler jobs (scan, email, news)

---

## Known Issues

### Auto-Runtime Startup Hang
**Status**: Temporarily disabled in `app/main.py` (startup handler commented out)

**Symptom**: Backend hangs on startup when `start_runtime()` is enabled.

**Root cause**: One of the startup jobs (news/email/scan) blocks the event loop.

**Workaround**: Auto-runtime is disabled. Scheduler jobs can be triggered manually via `/runtime/trigger` or will auto-run once the issue is debugged.

**Impact**:
- Notion 4-hour auto-sync doesn't run on startup
- News/email/scan auto-refresh disabled
- Manual triggers still work

**TODO**: Debug which startup job is blocking and fix async/sync interaction.

---

## Notion Integration Setup

1. Create internal integration at [notion.so/my-integrations](https://notion.so/my-integrations)
2. Copy token to `.env` as `NOTION_TOKEN`
3. Open **Productivity Dashboard** in Notion → `...` → Connections → Add your integration
4. Repeat for **Email Action Items** database
5. Test sync:
   ```bash
   curl -X POST http://127.0.0.1:8000/notion/sync \
     -H "X-API-Key: MAGE-local-v.1"
   ```

Expected: `{"synced": 42, "errors": [], "timestamp": "..."}`

---

## Development

### Backend
```bash
# Run with auto-reload
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Generate migration after model changes
python -m alembic revision --autogenerate -m "description"
python -m alembic upgrade head

# Test endpoints
curl http://127.0.0.1:8000/health -H "X-API-Key: MAGE-local-v.1"
```

### Frontend
```bash
# Tauri dev mode (desktop app)
npm run tauri dev

# Web-only dev server
npm run dev

# Build for production
npm run tauri build
```

---

## Project Structure

```
module_09/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # FastAPI route handlers
│   │   ├── core/             # Config, DB, runtime, security
│   │   ├── models/           # SQLAlchemy ORM models
│   │   └── services/         # Business logic (notion_sync, task_ingest, etc.)
│   ├── alembic/              # Database migrations
│   ├── .env.example          # Environment variables template
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── App.tsx           # Main app component
│   │   └── styles.css        # Global styles + theme system
│   ├── src-tauri/            # Tauri Rust shell
│   └── package.json          # Node dependencies
├── handoffs/                 # Agent handoff specs
├── blueprints/               # Architecture + UI audit docs
└── README.md                 # This file
```

---

## Support

Built by Lawrence Magee + Claude Cowork (AI executive assistant).

For issues, check:
1. Backend logs: `tail -f /tmp/module09.log` (if redirected)
2. `/status` endpoint for runtime health
3. `.env` configuration matches `.env.example`

---

## License

Proprietary — Malleus Prendere / MAGE Software
