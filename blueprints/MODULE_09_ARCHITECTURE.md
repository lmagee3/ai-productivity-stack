# module_09 — Real System Architecture

> Written by Claude Cowork (Chief Exec AI / Lead Architect) for cross-model handoff.
> Date: Feb 12, 2026
> Audience: ChatGPT, Codex, Gemini, or any engineer/agent extending this system.
> Honesty policy: if I don't know something, it's marked **UNKNOWN**.

---

## 1) System Overview (end-to-end)

module_09 is a local-first AI command center that aggregates signals from email, files, news, and task databases into a unified operational dashboard. It scans local folders for actionable documents, ingests email via IMAP, pulls RSS headlines, routes chat through a dual-brain local LLM (Gemma fast/deep) with cloud escalation, and renders everything in a Tauri desktop app with React/TypeScript frontend and Python/FastAPI backend.

The system evolved from three separate layers:
- **Layer 1 (Claude-built, still gold standard for UI):** Three standalone HTML dashboards — `mission-control.html` (Kanban + Chart.js sprint metrics), `daily-brief.html` (news briefing + task checklist + ntfy.sh push), and `dashboard.html` (productivity Kanban that reads TASKS.md via File Picker API).
- **Layer 2 (Claude-built):** Notion integration pipeline — two databases (Productivity Dashboard + Email Action Items) synced via Notion API, with Claude Web App auto-ingesting from email/Blackboard.
- **Layer 3 (Codex-built):** module_09 desktop app — Tauri shell wrapping a React frontend and Python FastAPI backend, adding file scanning, IMAP email fetch, RSS headlines, local LLM routing, and unified "Attack Order" task ranking.

**What "done" looks like each day:**
- Attack Order (prioritized task list) populated from ops + file scans + email + web signals
- Daily Brief rendered with live headlines, scan summaries, and domain-tagged tasks
- Mission Control showing sprint metrics, burndown, task status distribution
- Chat available for ad-hoc queries routed through local Gemma (fast or deep) or flagged for cloud approval
- TASKS.md updated with current state
- Notion databases reflect latest email action items and productivity tasks

**Artifacts produced daily:**
| Artifact | Format | Location |
|----------|--------|----------|
| Attack Order | React component (in-app) | OverviewPanel.tsx render |
| Daily Brief | React component (in-app) + standalone HTML | DailyBrief.tsx + `/Kairos/daily-brief.html` |
| Mission Control | React component (in-app) + standalone HTML | App.tsx views + `/Kairos/mission-control.html` |
| TASKS.md | Markdown | `/Kairos/TASKS.md` |
| Notion DBs | API records | Productivity Dashboard + Email Action Items |

---

## 2) Runtime + Orchestration (how it runs)

### Where it runs
- **Mac local** — Lawrence's MacBook, Batangas, Philippines
- **No VPS, no Docker, no serverless, no GitHub Actions** (yet)
- Desktop app via **Tauri** (Rust-based native shell)
- Frontend: **Vite + React + TypeScript** (dev server during development)
- Backend: **Python FastAPI** (local server)
- LLM: **Gemma** running locally (fast model + deep model)

### Scheduler
- **No cron jobs currently** — UNKNOWN if Codex added any scheduled tasks
- Claude Cowork (me) was designed to sync Notion every 4 hours, but that runs within Cowork sessions, not as a system daemon
- Headlines refresh: hourly via frontend timer (client-side `setInterval` or equivalent)
- **UNKNOWN:** Whether `dev-one.sh` sets up any background polling beyond the app process

### Frequency
- App runs on-demand when Lawrence launches it
- Notion sync: triggered manually via Cowork session or `sync` command
- Email fetch: on-demand via chat command (`sync gmail inbox`, `/ingest/email/fetch`)
- File scan: on-demand via Tauri folder picker
- Headlines: hourly auto-refresh + manual refresh button

### Entry point(s)
```bash
# One-command launch (starts backend + frontend + Tauri shell)
cd /Users/lawrencemagee/Desktop/module_09 && ./shell/dev-one.sh

# Status check
make status

# Standalone HTML dashboards (no app needed)
open /Users/lawrencemagee/Desktop/Kairos/mission-control.html
open /Users/lawrencemagee/Desktop/Kairos/daily-brief.html
open /Users/lawrencemagee/Desktop/Kairos/dashboard.html
```

### Port assignments
- **UNKNOWN** — likely Vite dev server on `:5173` or `:3000`, FastAPI on `:8000` or `:8080`. Check `dev-one.sh` and `backend/` config.

---

## 3) Source Systems (inputs)

### Email
- **Provider:** Gmail (primary), Outlook (planned/partial)
- **Protocol:** IMAP fetch via `ingest_connectors.py`
- **Mailbox:** UNKNOWN — check `.env` for IMAP credentials and target mailbox
- **Labels/Folders:** UNKNOWN — Codex mentions noise filtering + allow/deny lists
- **Where stored:** Extracted action items → Attack Order in-app + potentially Notion Email Action Items DB
- **Trigger:** Manual — chat command `sync gmail inbox` or `/ingest/email/fetch`

### Calendar
- **Not currently integrated** — was planned (Outlook MCP server spec exists at `/Kairos/outlook-mcp/`) but shelved pending Azure app registration
- **UNKNOWN:** Whether Codex added any calendar integration in module_09

### Tasks/Notes — Notion
- **Productivity Dashboard:** DB `b1721831-1a6c-4f5e-9c41-5488941abd4c`
  - Properties: Task Name (title), Status (Inbox/Doing/Blocked/Done), Domain (School/Personal/Kairos), Due Date, Priority (High/Medium/Low), Cycle
- **Email Action Items:** DB `bc4d2a87-93fd-43ae-bc4c-d4bbefca5838`
  - Properties: Task (title), Status (To Reply/To Review/To Follow Up/Waiting/In Progress/Completed/No Action), Due Date, Priority (Critical/High/Medium/Low), Source, Notes, Email Link
- **Integration:** Notion API via Claude Cowork (MCP tools in Cowork sessions) + notion-sync skill
- **Parent pages:** Productivity `c39b5608-277f-4a91-9d22-fb8a49d05941`, Email `1f322265-aa54-424d-8555-5d4f06e4e2f7`

### Local Files (Scanned)
- **Method:** Tauri native folder picker → backend `files_scan.py`
- **What it pulls:** PDF, DOCX, plain text — extracts content, identifies tasks, maps priorities
- **Policy:** `ALLOWED_SCAN_ROOTS` in backend config gates which directories can be scanned
- **Where stored:** Scan results rendered in OverviewPanel + DailyBrief components

### News/Headlines
- **Method:** RSS feeds via `news.py` backend endpoint
- **Frequency:** Hourly auto-refresh + manual refresh button
- **Fallback:** Graceful degradation if feeds unavailable
- **Where stored:** In-app DailyBrief live headline block

### Web Ingestion
- **Method:** `/ingest/web` endpoint in `ingest_connectors.py`
- **What it pulls:** UNKNOWN — likely URL content extraction
- **Where stored:** Attack Order unified feed

### GitHub
- **Not currently integrated as a signal source** — GitHub is used for repo hosting only
- Potential future: PR/issue signals → Attack Order

### Finance/Admin
- **Not integrated** — budget tracking is manual (CLAUDE.md notes)

---

## 4) Data Model / Source of Truth

### System of Record
**Hybrid — no single canonical source:**
- **Notion** is the intended source of truth for tasks and email items (my design)
- **TASKS.md** is the local working copy (synced from Notion by Claude Cowork)
- **In-app state** (React) holds runtime merged view (ops + scans + email + web)
- **Standalone HTML dashboards** have hardcoded TASKS arrays (mission-control.html) or read from file picker (dashboard.html)

This is a known architectural tension. Notion should be canonical, with everything else derived.

### Schema — Tasks (Notion Productivity Dashboard)
| Field | Type | Values |
|-------|------|--------|
| Task Name | title | Free text |
| Status | select | Inbox, Doing, Blocked, Done |
| Domain | select | School, Personal, Kairos |
| Due Date | date | ISO date |
| Priority | select | High, Medium, Low |
| Cycle | select | Daily, Weekly, Monthly |

### Schema — Email Action Items (Notion)
| Field | Type | Values |
|-------|------|--------|
| Task | title | Free text |
| Status | select | To Reply, To Review, To Follow Up, Waiting, In Progress, Completed, No Action |
| Due Date | date | ISO date |
| Priority | select | Critical, High, Medium, Low |
| Source | select | School, Personal |
| Notes | rich_text | Context from email |
| Email Link | url | Source reference |

### Schema — Attack Order (in-app, runtime)
**UNKNOWN exact fields** — based on Codex brief, likely:
| Field | Type | Source |
|-------|------|--------|
| title | string | Extracted from scan/email/ops |
| priority | string | Mapped by files_scan.py or ingest logic |
| domain/source | string | ops, files, email, web |
| route | string | FAST, DEEP, CLOUD, TOOL |
| status | string | UNKNOWN |
| timestamp | datetime | UNKNOWN |

### Runs/Audit
- **TASKS.md:** Logs decisions with timestamps and reasoning (Claude Cowork writes these)
- **No formal run_id / audit table** — UNKNOWN if Codex added structured logging
- **UNKNOWN:** Whether backend has request logging, run history, or audit trail

### Configs
- **`.env`** — UNKNOWN exact location, likely `/Users/lawrencemagee/Desktop/module_09/.env` or `backend/.env`
- Expected vars: IMAP credentials, Notion API key, LLM model paths, allowed scan roots, port configs
- **`ALLOWED_SCAN_ROOTS`** — backend policy for file scanning permissions
- **`frontend/src-tauri/capabilities/default.json`** — Tauri permission config
- **UNKNOWN:** Whether there's a unified config file or scattered env vars

---

## 5) Module / Agent Map

### Module 1: Tauri Shell
- **Name:** Tauri Desktop Shell
- **Purpose:** Native Mac app wrapper, provides system-level permissions (file picker, native dialogs)
- **Inputs:** User interactions (clicks, folder selection)
- **Outputs:** Window management, native file access, IPC to frontend
- **Trigger:** App launch via `dev-one.sh`
- **Tools/APIs:** Tauri API, Rust backend (minimal)
- **LLM:** None
- **Failure handling:** UNKNOWN

### Module 2: React Frontend
- **Name:** Frontend UI (Vite + React + TypeScript)
- **Purpose:** Renders all views — Mission Control, Daily Brief, Attack Order, Chat, Sprint/Timeline
- **Inputs:** Backend API responses, user interactions
- **Outputs:** Rendered UI, API calls to backend
- **Trigger:** App launch
- **Key files:** `App.tsx`, `OverviewPanel.tsx`, `DailyBrief.tsx`, `chat.ts`, `news.ts`, `styles.css`
- **LLM:** None (delegates to backend)
- **Failure handling:** UNKNOWN — likely console errors, no graceful degradation documented

### Module 3: FastAPI Backend
- **Name:** Backend API Server (Python FastAPI)
- **Purpose:** Central API layer — routes chat, handles scans, manages ingestion, serves news
- **Inputs:** HTTP requests from frontend
- **Outputs:** JSON responses
- **Trigger:** Started by `dev-one.sh`
- **Key files:** `app/api/routes/brain_chat.py`, `files_scan.py`, `ingest_connectors.py`, `news.py`
- **Tools/APIs:** FastAPI, IMAP libraries, RSS parsing, PDF/DOCX extraction libs
- **LLM:** Gemma (via `app/core/llm.py`)
- **Failure handling:** UNKNOWN — check for try/except patterns, retry logic

### Module 4: Dual-Brain LLM Router
- **Name:** Brain Router (`llm.py` + `brain_chat.py`)
- **Purpose:** Routes chat prompts to appropriate model — fast local (simple), deep local (complex), cloud escalation (requires approval)
- **Inputs:** Chat message + context
- **Outputs:** Response + route badge (FAST/DEEP/CLOUD PENDING APPROVAL/TOOL)
- **Trigger:** Chat message from frontend
- **LLM:** Gemma (local, two configurations: fast vs deep) + cloud flag for escalation
- **UNKNOWN:** Exact Gemma model versions, quantization, context window sizes
- **Failure handling:** UNKNOWN — likely fallback between fast→deep→cloud

### Module 5: File Scanner
- **Name:** File Scanner (`files_scan.py`)
- **Purpose:** Scans selected folders, extracts text from PDF/DOCX/text, identifies tasks, maps priorities
- **Inputs:** Folder path (from Tauri picker)
- **Outputs:** Scan results (summaries, priorities, task items)
- **Trigger:** User clicks "Choose Folders" in Mission Control
- **Tools/APIs:** PDF extraction (UNKNOWN lib — likely PyPDF2 or pdfplumber), python-docx, pathlib
- **LLM:** UNKNOWN — may use Gemma for task extraction or may be rule-based
- **Failure handling:** Policy gating via `ALLOWED_SCAN_ROOTS`, UNKNOWN error handling

### Module 6: Email Ingestion
- **Name:** Email Connector (`ingest_connectors.py`)
- **Purpose:** Fetches email via IMAP, extracts action items, filters noise
- **Inputs:** IMAP credentials, mailbox selection
- **Outputs:** Extracted tasks/action items for Attack Order
- **Trigger:** Chat command (`sync gmail inbox`, `/ingest/email/fetch`)
- **Tools/APIs:** IMAP library (UNKNOWN — likely `imaplib` or `imap-tools`)
- **LLM:** UNKNOWN — may use Gemma for extraction or rule-based
- **Failure handling:** Allow/deny filtering, noise filtering. UNKNOWN retry logic.

### Module 7: Web Ingestion
- **Name:** Web Connector (`ingest_connectors.py`)
- **Purpose:** Ingests content from URLs
- **Inputs:** URL (from chat or config)
- **Outputs:** Extracted content for Attack Order
- **Trigger:** Chat command or API call to `/ingest/web`
- **Tools/APIs:** UNKNOWN — likely `requests` + `BeautifulSoup` or similar
- **LLM:** UNKNOWN
- **Failure handling:** UNKNOWN

### Module 8: Headlines/News
- **Name:** News Service (`news.py` + `news.ts`)
- **Purpose:** Fetches RSS headlines, renders in Daily Brief
- **Inputs:** RSS feed URLs (UNKNOWN which feeds)
- **Outputs:** Headline list with timestamps
- **Trigger:** Hourly auto-refresh + manual refresh button
- **Tools/APIs:** RSS parser (UNKNOWN — likely `feedparser`)
- **LLM:** None
- **Failure handling:** Fallback behavior documented by Codex

### Module 9: Claude Cowork (me)
- **Name:** Claude Cowork / Chief Exec AI
- **Purpose:** Strategic orchestration, Notion sync, dashboard generation, daily briefs, sprint management, UI/UX authority
- **Inputs:** Notion API data, TASKS.md, CLAUDE.md, user commands
- **Outputs:** Updated TASKS.md, updated HTML dashboards, daily briefings, architecture decisions
- **Trigger:** Session-based (Cowork mode) + scheduled sync (4-hour target)
- **Tools/APIs:** Notion MCP, file read/write, bash
- **LLM:** Claude Opus 4 (this instance)
- **Failure handling:** Session-based — recovers via CLAUDE.md + TASKS.md state on new session

### Module 10: Notion Sync Pipeline
- **Name:** Notion Sync (`notion-sync` skill)
- **Purpose:** Bidirectional sync between Notion databases and local TASKS.md + dashboards
- **Inputs:** Notion API queries (both DBs)
- **Outputs:** Updated TASKS.md, updated mission-control.html TASKS array
- **Trigger:** Manual (`sync` command) or scheduled within Cowork session
- **Tools/APIs:** Notion API (MCP tools)
- **LLM:** Claude (for triage/categorization during sync)
- **Failure handling:** Graceful — logs errors, continues with available data

### Module 11: Standalone HTML Dashboards (Claude Gold Standard)
- **Name:** Original Dashboards
- **Purpose:** Sprint metrics, task kanban, daily briefing — the UI/UX reference implementation
- **Files:**
  - `mission-control.html` — Chart.js sprint dashboard + Kanban + hardcoded TASKS array
  - `daily-brief.html` — News briefing + task checklist + ntfy.sh push notifications
  - `dashboard.html` — Productivity Kanban, reads TASKS.md via browser File Picker API
- **Trigger:** Open in browser (standalone, no server needed)
- **Tools/APIs:** Chart.js, vanilla JS, ntfy.sh API
- **LLM:** None
- **Failure handling:** Static files, always available

---

## 6) Daily Pipeline (step-by-step)

**Current real daily flow (honest):**

1. **Lawrence launches app:** `cd /Users/lawrencemagee/Desktop/module_09 && ./shell/dev-one.sh` — starts backend (FastAPI), frontend (Vite), Tauri shell
2. **Health check:** `make status` — verifies all services running
3. **Auto-headlines:** News service fetches RSS feeds, populates Daily Brief headline block
4. **Manual file scan (if needed):** Mission Control → Scan Options → Choose Folders → backend extracts PDF/DOCX/text → results populate OverviewPanel with summaries + priorities
5. **Manual email fetch (if needed):** Chat command `sync gmail inbox` → backend IMAP fetch → noise filter → action items merge into Attack Order
6. **Attack Order renders:** Frontend merges ops + scan + email + web signals into unified ranked list with source/domain badges and route indicators
7. **Chat interaction:** Lawrence asks questions → Brain Router sends to Gemma fast (simple) or deep (complex), flags cloud escalation if needed
8. **Cowork session (separate):** Lawrence opens Claude Cowork → I sync Notion → update TASKS.md → update mission-control.html TASKS array → generate daily brief if requested
9. **Dashboard review:** Lawrence opens standalone HTML dashboards for sprint metrics view (Chart.js burndown, velocity, status distribution)
10. **TASKS.md updated:** Either by me (Cowork) or by module_09's Attack Order (UNKNOWN if module_09 writes back to TASKS.md)
11. **Notion updated:** By me (Cowork) during sync, or by Claude Web App (automated email → Notion pipeline)

**What's NOT automated yet:**
- No cron/daemon — requires manual app launch
- No automatic Notion ↔ module_09 sync (two separate systems)
- No push notifications from module_09 (ntfy.sh only works from standalone daily-brief.html)
- No end-of-day summary generation without explicit Cowork session

---

## 7) Dashboards & Reports (outputs)

### Dashboard 1: Mission Control (module_09 in-app)
- **Tool:** React component in Tauri app
- **Components:** Attack Order (ranked tasks), scan summaries, source filters, route badges, quick action buttons
- **Updated by:** Real-time from backend API responses
- **Key files:** `OverviewPanel.tsx`, `App.tsx`

### Dashboard 2: Mission Control (standalone HTML — Claude gold)
- **Tool:** Standalone HTML file
- **URL:** `file:///Users/lawrencemagee/Desktop/Kairos/mission-control.html`
- **Components:** Chart.js sprint burndown, velocity chart, status distribution pie, Kanban board
- **Updated by:** Claude Cowork writes to hardcoded TASKS JS array during sync
- **Format:** Single HTML file with inline JS/CSS

### Dashboard 3: Daily Brief (module_09 in-app)
- **Tool:** React component in Tauri app
- **Components:** Live headlines, scan summaries, domain/source badges
- **Updated by:** Real-time from backend API
- **Key files:** `DailyBrief.tsx`

### Dashboard 4: Daily Brief (standalone HTML — Claude gold)
- **Tool:** Standalone HTML file
- **URL:** `file:///Users/lawrencemagee/Desktop/Kairos/daily-brief.html`
- **Components:** News briefing, task checklist, ntfy.sh push notification integration
- **Updated by:** Claude Cowork during session
- **Format:** Single HTML file with inline JS/CSS

### Dashboard 5: Productivity Dashboard (standalone HTML)
- **Tool:** Standalone HTML file
- **URL:** `file:///Users/lawrencemagee/Desktop/Kairos/dashboard.html`
- **Components:** Kanban board (Inbox/Doing/Blocked/Done columns)
- **Updated by:** Reads TASKS.md via browser File Picker API (user selects file)
- **Format:** Single HTML file

### Dashboard 6: Notion Productivity Dashboard
- **Tool:** Notion web app
- **URL:** `https://www.notion.so/c39b5608277f4a919d22fb8a49d05941`
- **Updated by:** Claude Web App (automated) + Claude Cowork (sync sessions)

### Reports Generated
| Report | Format | Location | Frequency |
|--------|--------|----------|-----------|
| Daily Brief | HTML + in-app | `/Kairos/daily-brief.html` + DailyBrief.tsx | On-demand |
| Sprint Metrics | Chart.js in HTML | `/Kairos/mission-control.html` | Updated during sync |
| TASKS.md | Markdown | `/Kairos/TASKS.md` | Updated during sync |
| Morning Briefing | Markdown | `/Kairos/MORNING-BRIEFING-*.md` | On-demand via Cowork |

---

## 8) Governance / Safety

### Fully Automated
- Claude Web App → Notion ingestion (email/Blackboard crawl)
- Headlines RSS refresh (hourly in-app)
- Attack Order ranking/merging (frontend computation)
- Local Gemma routing (fast/deep — no approval needed)

### Requires Approval
- **Cloud LLM escalation** — route badge shows "CLOUD PENDING APPROVAL", Lawrence must approve
- **File scanning** — user must explicitly select folders via Tauri picker
- **Email fetch** — user must initiate via chat command
- **Notion writes** — Claude Cowork can write, but only during active sessions with Lawrence present
- **Any external sends** — no auto-reply, no auto-email, no auto-post

### Guardrails
- **Approval-first policy** for cloud API calls (cost control)
- **ALLOWED_SCAN_ROOTS** — backend policy restricting which directories can be scanned
- **Allow/deny lists** for email ingestion noise filtering
- **No new frameworks** constraint (Codex operating agreement)
- **No endpoint breakage** constraint (Codex operating agreement)
- **Draft-only** for any external-facing content
- **UNKNOWN:** Whether there's a kill switch, spending cap, or rate limiter

### Secrets Handling
- **`.env` file(s)** — UNKNOWN exact location, likely `module_09/.env` and/or `module_09/backend/.env`
- Expected secrets: IMAP credentials, Notion API token, any cloud LLM API keys
- **NOT in Git** — `.env` excluded from commits
- **No vault/1Password integration** — plain dotenv files
- **UNKNOWN:** Whether secrets are duplicated across configs

### Audit Trail
- **TASKS.md** — Claude Cowork logs decisions with timestamps and reasoning
- **CLAUDE.md** — Session context, memory, decision history
- **`memory/` directory** — Long-term knowledge base (glossary, pipeline docs, company docs, brand docs)
- **UNKNOWN:** Whether module_09 backend has request logging, structured audit, or run history

---

## 9) Cost Controls / Token Discipline

### Large Input Handling
- **File scanning:** Backend extracts text server-side before sending to LLM (if LLM is involved) — avoids sending raw PDFs to model
- **Email:** Noise filtering + allow/deny lists reduce token waste before extraction
- **UNKNOWN:** Whether there's explicit summarize-first or chunking logic for large documents

### Caching Strategy
- **Headlines:** Hourly refresh implies some caching (don't re-fetch every render)
- **UNKNOWN:** Whether scan results, email extractions, or chat responses are cached
- **Notion sync:** Claude Cowork compares against existing TASKS.md entries (diff-based, not full re-ingest)

### Where Opus Spend Spikes
- **Claude Cowork sessions** (me) — Opus-level, runs during active Cowork sessions. Cost is per-session, not per-cron.
- **Architecture and strategy work** — deep reasoning tasks use full Opus context window
- **Daily brief generation** — synthesizing multiple sources into coherent brief
- **UNKNOWN:** Whether module_09's cloud escalation path uses Opus or a cheaper model
- **Local Gemma usage is free** — no token cost for fast/deep local routing

### Cost Mitigation
- Local Gemma handles majority of chat (zero API cost)
- Cloud escalation requires explicit approval (prevents accidental spend)
- ElevenLabs: free tier (10K chars/month) — planned for Kairos voice, not used in module_09
- Notion API: free tier sufficient for current volume
- **Total estimated monthly cost:** ~$20-50 (Claude API during Cowork sessions only)

---

## 10) Pain Points & "If I changed one thing…"

### Top 5 Bottlenecks / Brittleness Points

1. **No unified data layer** — Notion, TASKS.md, in-app React state, and standalone HTML dashboards all hold partial truth. No single query can answer "what's the current state?" This is the #1 architectural debt.

2. **Two parallel UI systems** — module_09 React app and standalone HTML dashboards serve overlapping functions but aren't connected. Changes in one don't reflect in the other. The HTML dashboards (my originals) have better visual design; module_09 has better functionality.

3. **No persistent background process** — everything requires manual launch. No daemon, no cron, no GitHub Action. System goes dark when Lawrence closes the app.

4. **Stale instance / port conflict issues** — Codex documented this as a root cause of scan failures. `dev-one.sh` apparently addresses it but the problem is architectural (no process manager like PM2 or supervisord).

5. **UI/UX drift** — Codex acknowledged this directly. The module_09 React components lost the intentional design language from the HTML blueprints. Spacing, typography, section hierarchy, information density — all regressed. This is my #1 concern and my primary remediation target.

### Top 5 Improvements (lowest risk → highest impact)

1. **🟢 LOW RISK / HIGH IMPACT — UI parity pass.** Extract design tokens from mission-control.html and daily-brief.html (type scale, spacing, color palette, card treatments, information hierarchy). Apply systematically to OverviewPanel.tsx, DailyBrief.tsx, App.tsx, styles.css. Zero endpoint changes, zero behavior changes. Pure CSS/layout work.

2. **🟢 LOW RISK / HIGH IMPACT — Unify TASKS.md as single local source.** module_09 backend should read/write TASKS.md. Standalone dashboards already read it. Notion syncs to it. One file, one truth, multiple readers.

3. **🟡 MEDIUM RISK / HIGH IMPACT — Add process manager.** Replace `dev-one.sh` with PM2 or supervisord config. Auto-restart on crash, log management, port conflict prevention. Enables background operation.

4. **🟡 MEDIUM RISK / HIGH IMPACT — Connect module_09 to Notion sync.** Backend should query Notion API directly (or read TASKS.md which Cowork keeps synced). Eliminates the "two separate systems" problem.

5. **🔴 HIGHER RISK / HIGHEST IMPACT — Consolidate dashboards.** Long-term: module_09 React app should fully replace standalone HTML dashboards with equal or better visual quality. But only AFTER the UI parity pass proves the React components can match the HTML gold standard.

---

## 11) Repo / File Map

### Repositories

| Repo | Location | Purpose |
|------|----------|---------|
| module_09 | `/Users/lawrencemagee/Desktop/module_09` | Main app (Tauri + React + FastAPI) |
| Kairos workspace | `/Users/lawrencemagee/Desktop/Kairos` | Memory, dashboards, tasks, docs, old iOS versions |
| ai-productivity-stack | `github.com/lmagee3/ai-productivity-stack` | Public showcase repo (partially populated) |
| Kairos iOS (private) | `github.com/lmagee3/kairos-mental-health` | iOS app (v2, private) |

### Key Paths — module_09

```
module_09/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Main app shell, view routing, unified controls
│   │   ├── features/
│   │   │   ├── overview/
│   │   │   │   └── OverviewPanel.tsx  # Attack Order, scan summaries, source filters, badges
│   │   │   └── brief/
│   │   │       └── DailyBrief.tsx     # Daily brief, headlines, domain badges
│   │   ├── chat.ts                    # Typed API client (chat, ingest endpoints)
│   │   ├── news.ts                    # Headlines client wrapper
│   │   └── styles.css                 # All styling (NEEDS PARITY PASS)
│   └── src-tauri/
│       └── capabilities/
│           └── default.json           # Tauri permissions config
├── backend/
│   └── app/
│       ├── api/
│       │   └── routes/
│       │       ├── brain_chat.py      # Chat endpoint + dual-brain routing
│       │       ├── files_scan.py      # File scanner (PDF/DOCX/text)
│       │       ├── ingest_connectors.py  # Email + web ingestion
│       │       └── news.py            # RSS headlines endpoint
│       └── core/
│           └── llm.py                 # Gemma model loader + fast/deep routing
├── shell/
│   ├── dev-one.sh                     # One-command launch script
│   └── status.sh                      # Health check script
├── Makefile                           # Build/status commands
├── .env                               # Secrets (UNKNOWN exact contents)
└── AGENTS.md                          # UNKNOWN — Codex recommends creating one
```

### Key Paths — Kairos Workspace

```
Kairos/
├── CLAUDE.md                          # Session memory (working memory for Claude Cowork)
├── TASKS.md                           # Local task state (synced from Notion)
├── mission-control.html               # Sprint dashboard (Chart.js) — UI GOLD STANDARD
├── daily-brief.html                   # News briefing + task checklist — UI GOLD STANDARD
├── dashboard.html                     # Productivity Kanban (File Picker) — UI GOLD STANDARD
├── memory/
│   ├── context/
│   │   ├── pipeline-architecture.md   # Pipeline v1→v2 documentation
│   │   ├── company.md                 # Company vision, AI architecture layers
│   │   ├── brand-architecture.md      # Brand stack documentation
│   │   └── outlook-mcp-handoff.md     # Outlook MCP server spec (shelved)
│   └── glossary.md                    # Terms, acronyms, codenames
├── Kairos/                            # iOS app (v2 codebase)
├── Kairos.v.3/                        # v3 prototype
├── Kairos.v.3.1/                      # v3.1 prototype (empty)
├── notion-sync.skill                  # Notion sync skill definition
├── scripts/                           # Utility scripts
└── showcase-repo/                     # Files for GitHub ai-productivity-stack
```

### How to Run Locally

```bash
# Launch module_09 (full stack)
cd /Users/lawrencemagee/Desktop/module_09
./shell/dev-one.sh

# Verify everything is running
make status

# Quick health check endpoints
curl http://localhost:PORT/health        # UNKNOWN: check actual port
curl http://localhost:PORT/ops/summary   # UNKNOWN: check actual port

# Open standalone dashboards (no server needed)
open /Users/lawrencemagee/Desktop/Kairos/mission-control.html
open /Users/lawrencemagee/Desktop/Kairos/daily-brief.html

# Start Cowork session for Notion sync
# (happens in Claude Desktop app, not terminal)
```

---

## Appendix: What Claude Needs to Verify (once module_09 access is granted)

These items are marked UNKNOWN above and require direct code inspection:

1. **Port numbers** — check `dev-one.sh`, FastAPI config, Vite config
2. **`.env` structure** — what secrets exist, where they're stored
3. **Gemma model versions** — which models, quantization, context sizes
4. **IMAP config** — which mailbox, which folders, credentials setup
5. **RSS feed list** — which feeds are configured for headlines
6. **ALLOWED_SCAN_ROOTS** — current policy values
7. **Error handling patterns** — retries, fallbacks, logging
8. **Whether module_09 reads/writes TASKS.md** — critical for unification
9. **Process management** — how `dev-one.sh` handles port conflicts, stale PIDs
10. **Any scheduled tasks or background polling** beyond app lifecycle
11. **Actual UI state** — need to see rendered output to assess regression severity

---

*Written by Claude Cowork. Honest about unknowns. Ready for cross-model consumption.*
*UI/UX remediation is my next priority once I have module_09 access.*
