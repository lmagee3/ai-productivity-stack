# Codex Handoff Brief — Feb 13, 2026

**From**: Claude Cowork (Executive AI)
**To**: Codex (Infrastructure AI)
**Project**: module_09 (MAGE Productivity OS)
**Priority**: High — execute in order

---

## Overview

You have three tasks in priority order. Task 1 is the primary deliverable. Assume Lawrence has created the Notion internal integration token and connected both databases before you start. If he hasn't, ask before proceeding.

Read the **entire** `handoffs/notion-integration-spec.md` before touching any code.

---

## Task 1: Notion Backend Integration (PRIMARY)

### What You're Building

A bidirectional sync layer that pulls tasks from two Notion databases (Productivity Dashboard + Email Action Items), normalizes them into a unified `notion_tasks` table, and exposes them via REST API.

The system runs on a 4-hour scheduler. Lawrence can manually trigger `/notion/sync` to force refresh. Query results are available at `/notion/tasks` with optional filters.

### Architecture

```
Notion API (2 databases)
        ↓ (queries)
Notion Sync Service (parses, normalizes, deduplicates)
        ↓ (upserts)
SQLAlchemy notion_tasks table
        ↓ (HTTP)
GET /notion/tasks (filtered by status, domain, priority)
POST /notion/sync (manual refresh)
```

### Implementation Checklist

- [ ] **Database schema**: Create `notion_tasks` table with columns:
  - `id` (UUID, primary key)
  - `notion_id` (string, unique per DB)
  - `source_db` (enum: `productivity` | `email`)
  - `title` (string)
  - `status` (string)
  - `domain` (string, nullable for email DB)
  - `priority` (string)
  - `due_date` (datetime, nullable)
  - `created_at` (datetime, auto-now)
  - `updated_at` (datetime, auto-now-on-update)
  - `last_synced` (datetime)
  - `raw_payload` (JSON, for debugging)

- [ ] **Alembic migration**: Generate and apply migration to create table

- [ ] **Notion sync service** (`backend/services/notion_sync.py`):
  - `NotionService` class with:
    - `query_productivity_db()` → list of normalized task dicts
    - `query_email_db()` → list of normalized task dicts
    - `normalize_task()` → handle field mapping, emoji stripping, status aliasing
    - `sync()` → query both DBs, deduplicate by (source_db, notion_id), upsert to SQL
  - Error handling: log failures, don't crash scheduler

- [ ] **API routes** (`backend/routes/notion_routes.py`):
  - `POST /notion/sync` — trigger manual sync (returns status)
  - `GET /notion/tasks` — query with optional filters:
    - `?status=doing` (case-insensitive substring match)
    - `?domain=kairos` (exact match)
    - `?priority=high` (exact match)
    - `?source_db=productivity` (enum: `productivity` | `email` | `all`)
  - Responses use standard envelope: `{ "data": [...], "meta": { "synced_at": "...", "count": ... } }`

- [ ] **Scheduler job** (`backend/scheduler/jobs/notion_sync_job.py`):
  - Job runs every 4 hours
  - Calls `NotionService.sync()`
  - Logs results
  - No email notifications (keep it quiet)

- [ ] **Execution policy**: Add `notion.sync` to `SAFE_TOOLS` in `backend/config/execution_policy.py`

- [ ] **Route registration**: Import and register `notion_routes.py` in `backend/main.py`

### Critical Field Mapping Rules

**Productivity Database** (`b1721831-1a6c-4f5e-9c41-5488941abd4c`):
- Title property: **"Task Name"**
- Status property: **"status"** (type: `status`)
- Domain property: **"Domain"** (type: `select`) → values: "School", "Personal", "Kairos"
- Priority property: **"Priority"** (type: `select`) → values: "High", "Medium", "Low"
- Due Date property: **"Due Date"** (type: `date`)

**Email Database** (`bc4d2a87-93fd-43ae-bc4c-d4bbefca5838`):
- Title property: **"Task"** (NOT "Task Name")
- Status property: **"status"** (type: `status`)
- Domain property: NONE (set to null in normalized output)
- Priority property: **"Priority"** (type: `select`) → values: "Critical", "High", "Medium", "Low"
- Due Date property: IGNORE **"Next Due Date"** (it's a formula field, skip it)
- Email Link property: **"Email Link"** (type: `url`) → store in separate field if useful

### Status Aliasing

Notion status colors map to internal status strings. Handle these exact mappings:

**Productivity DB status values**:
- `"Inbox"` → `"inbox"`
- `"Doing"` → `"doing"`
- `"Blocked"` → `"blocked"`
- `"Done"` → `"done"`

**Email DB status values**:
- `"To Reply"` → `"to-reply"`
- `"To Review"` → `"to-review"`
- `"To Follow Up"` → `"to-followup"`
- `"Waiting on Response"` → `"waiting"` (NOT "Waiting")
- `"In Progress"` → `"in-progress"`
- `"Completed"` → `"completed"`
- `"No Action Needed"` → `"no-action"` (NOT "No Action")

### Emoji Stripping

Task titles sometimes have emoji prefixes like "🔥 High Priority" or "📧 Email Response Needed". Strip leading emoji before storing. Regex pattern: `^\s*[\p{Emoji}\p{Emoji_Component}]+\s*` (or simpler: strip anything in the first 3 characters that isn't alphanumeric).

### Testing & Validation

Before running scheduler, manually test with curl:

```bash
# Force sync
curl -X POST http://localhost:8000/notion/sync \
  -H "X-API-Key: $MODULE09_API_KEY" \
  -H "Content-Type: application/json"

# Query all tasks
curl http://localhost:8000/notion/tasks \
  -H "X-API-Key: $MODULE09_API_KEY"

# Filter by status
curl "http://localhost:8000/notion/tasks?status=doing" \
  -H "X-API-Key: $MODULE09_API_KEY"

# Filter by domain
curl "http://localhost:8000/notion/tasks?domain=kairos" \
  -H "X-API-Key: $MODULE09_API_KEY"

# Filter by priority
curl "http://localhost:8000/notion/tasks?priority=high" \
  -H "X-API-Key: $MODULE09_API_KEY"

# Filter by source_db
curl "http://localhost:8000/notion/tasks?source_db=email" \
  -H "X-API-Key: $MODULE09_API_KEY"
```

Validate response structure:
- Check `meta.synced_at` updates on each sync
- Verify task count matches Notion (36 Productivity + 26 Email = 62 total, minus Done/Completed)
- Spot-check emoji removal and status aliasing
- Ensure no duplicate notion_ids across source DBs

### Dependencies

- `requests` (already in requirements.txt)
- `python-dateutil` (if not present, add it)
- SQLAlchemy (already present)
- Notion Python SDK (add to requirements.txt if not present: `notion-client>=2.2.0`)

### Prerequisite: Lawrence's Setup

Before you start, Lawrence MUST have:
1. Created an internal integration at https://notion.so/my-integrations
2. Copied the integration token (secret) to `.env` as `NOTION_TOKEN`
3. Connected both databases to the integration (grant "Read content" permission)
4. Verified the database IDs are correct in `.env` or hardcoded

If `NOTION_TOKEN` is not set in `.env` when you run `/notion/sync`, the API call fails gracefully with a 503 "Integration not configured" response.

---

## Task 2: GitHub Restoration

### 2a. Push Files to Repo

Ensure these files exist in the module_09 repo and are committed:

- `README.md` — overview of the project (should already exist)
- All 6 docs in the `docs/` directory (e.g., `docs/ARCHITECTURE.md`, `docs/API.md`, etc.)

Check that all docs are properly formatted Markdown with headers, code blocks, and links.

**Action**: `git add docs/ README.md && git commit -m "Add documentation"` and push.

### 2b. Update GitHub Profile Bio

Edit your GitHub profile bio (https://github.com/settings) to reflect:
- AI productivity system builder
- Army IT veteran
- MBA candidate

**Example**: "AI productivity system builder | 20yr Army IT vet | MBA candidate, Bellevue University"

Keep it under 160 characters. Professional but approachable.

### 2c. Pin the module_09 Repo

In the GitHub repo settings, pin `module_09` to your profile so it appears prominently in your "Pinned" section (visible on your profile page).

### 2d. Delete Tutorial/Practice Repos

Scan your GitHub for any repos that are clearly:
- Hello-world projects
- Tutorial follow-alongs
- Practice coding exercises
- Abandoned prototypes

**Do NOT delete**:
- module_09 (primary project)
- Kairos (iOS app)
- Any live/active projects

If you're unsure whether a repo should be deleted, **ask Claude Cowork first**. When in doubt, leave it.

---

## Task 3: Backbrief

When **all tasks are complete**, write a completion report to:

`handoffs/CODEX_BACKBRIEF_2026-02-13.md`

### Backbrief Template

```markdown
# Codex Backbrief — Feb 13, 2026

## Completed Tasks
- [ ] Task 1a: Notion backend integration (SQLAlchemy schema, migration)
- [ ] Task 1b: Notion sync service (query, normalize, upsert)
- [ ] Task 1c: API routes (/notion/sync, /notion/tasks)
- [ ] Task 1d: Scheduler job (4-hour interval)
- [ ] Task 1e: Execution policy update
- [ ] Task 1f: Route registration
- [ ] Task 1g: Manual testing (curl validation)
- [ ] Task 2a: Push docs to GitHub
- [ ] Task 2b: Update GitHub bio
- [ ] Task 2c: Pin module_09 repo
- [ ] Task 2d: Delete tutorial repos (if applicable)

## Testing Results
- Sync endpoint: [PASS | FAIL] — synced X tasks in Y seconds
- Query filters: [PASS | FAIL] — status, domain, priority, source_db all work
- Scheduler: [PASS | FAIL] — job runs every 4 hours, last run at HH:MM
- GitHub: [PASS | FAIL] — docs pushed, bio updated, repo pinned

## Issues Encountered
[List any blockers, API failures, schema conflicts, etc.]

## Notes for Claude Cowork
[Anything that needs review, approval, or escalation]

## Commit Hash
[git log --oneline -1]
```

Include concrete test results. If any test failed, explain why and what needs to be fixed.

---

## Scope Boundaries — READ THIS CAREFULLY

### You OWN (Infrastructure Layer)
- Backend routes, API contracts, HTTP plumbing
- Database models, migrations, schema design
- Scheduler jobs, cron logic, background workers
- API integration (Notion SDK, external service calls)
- Environment variables, secrets management
- DevOps, deployment scripts, shell commands
- Backend error handling, logging

### You DO NOT TOUCH (Product/Frontend Layer)
- **Any file in `frontend/src/`** (App.tsx, components, styles.css)
- UI/UX decisions, layout changes, component structure
- Theme system, CSS custom properties, visual design
- User-facing text, copy, labels
- Blueprint files in `blueprints/` (reserved for Claude Cowork)
- Product requirements, feature scope, user workflows

### Escalation Protocol

**If you hit a product/UI question:**
1. Stop work on that subtask
2. Document the question in your backbrief
3. Add a note for Claude Cowork with context
4. Move to the next task or wait for direction

**Example**: "Notion sync returns 100+ tasks — should I paginate the response by default, or let the frontend handle it? Need approval on API contract."

### UI/Frontend Rules (For Reference)

- NO hardcoded colors (hex/rgb) — use CSS custom properties like `var(--primary-color)`
- NO layout changes without approval
- NO new npm dependencies in frontend without approval
- Theme system uses `body[data-theme="dark|light|crt"]` data attribute
- Component props must be documented
- All API calls from frontend must use the `x-api-key` header

These rules don't affect your work, but they're here so you know not to step on those boundaries.

---

## Environment & Config

### .env Variables (Must Be Set Before Starting)
```
NOTION_TOKEN=<Lawrence provides this>
DATABASE_URL=<already set>
MODULE09_API_KEY=<already set>
```

### Backend Structure (Reference)
```
backend/
├── main.py (FastAPI app)
├── config/
│   ├── execution_policy.py
│   └── settings.py
├── routes/
│   ├── notion_routes.py (you create this)
│   └── ... (existing routes)
├── services/
│   ├── notion_sync.py (you create this)
│   └── ... (existing services)
├── models/
│   └── ... (SQLAlchemy ORM models)
├── scheduler/
│   ├── jobs/
│   │   └── notion_sync_job.py (you create this)
│   └── scheduler.py
└── migrations/
    └── alembic/ (Alembic schema migrations)
```

---

## Success Criteria

### Task 1: Notion Integration
- [ ] `notion_tasks` table exists in database
- [ ] Manual `/notion/sync` endpoint returns 200 with synced task count
- [ ] All 4 filter types work: `?status=`, `?domain=`, `?priority=`, `?source_db=`
- [ ] Scheduler runs every 4 hours without errors
- [ ] Notion API errors (rate limit, bad token) are caught and logged gracefully
- [ ] No duplicate tasks stored (unique constraint on `source_db` + `notion_id`)

### Task 2: GitHub
- [ ] All 6 docs committed and pushed
- [ ] Profile bio updated and visible
- [ ] module_09 pinned on profile
- [ ] Tutorial repos deleted (if applicable)

### Task 3: Backbrief
- [ ] Report written and detailed
- [ ] All subtasks marked complete or documented as incomplete
- [ ] Test results clear and reproducible
- [ ] Any blockers escalated

---

## Communication

When you're done:
1. Push all commits to the repo
2. Write the backbrief to `handoffs/CODEX_BACKBRIEF_2026-02-13.md`
3. Post the backbrief link and a summary in the channel or reply here

If you hit a blocker that's not in your lane (e.g., need UI decisions), **stop and escalate immediately**. Don't guess.

---

## One More Thing

The Notion integration is the spine of the entire pipeline. This feeds Lawrence's daily briefs, task priority, and dashboard. Get it right. Test thoroughly. If the sync is slow or loses data, everything downstream breaks.

You've got this. Execute in order. Ask if you need clarification.

**Codex, you own this now.**
