# Data Flow Architecture

This document describes how data moves through the MAGE Software system, from collection to agent processing to product delivery.

---

## Overview

The system operates on **three principles**:

1. **Local-first data sovereignty** — SQLite/PostgreSQL as source of truth
2. **Notion as external sync target** — Team visibility without cloud lock-in
3. **Multi-stage pipeline** — Task collection → triage → assignment → execution → delivery

---

## 1. Task Ingestion Pipeline

### 1.1 Sources of Truth

Tasks enter the system from multiple sources, all syncing to **Notion** as the external buffer, then back to **Local SQLite** as the source of truth.

```
Email Inbox           →  Notion Email DB  →  Local SQLite  →  module_09 UI
Blackboard Tasks      →  Notion MBA DB    →  Local SQLite  →  module_09 UI
Manual Creation       →  Notion Create    →  Local SQLite  →  module_09 UI
Slack/Messages (TBD)  →  Notion Ingest    →  Local SQLite  →  module_09 UI
```

#### Email Tasks
- **Source**: Gmail, Outlook, Titan email
- **Ingestion**: ChatGPT crawls email inbox
- **Notion DB**: "Email Action Items" (`bc4d2a87-93fd-43ae-bc4c-d4bbefca5838`)
- **Properties**: Task, Status, Due Date, Priority, Source, Notes, Email Link
- **Update Frequency**: Every 4 hours (async)

#### MBA/School Tasks
- **Source**: Blackboard LMS + emails
- **Ingestion**: ChatGPT crawls Blackboard + emails
- **Notion DB**: "MBA Tasks Daily Brief Report" (`309ed29a-2491-8000-a417-c0288ce2a9b6`)
- **Properties**: Task Name, Course, Due Date, Priority, Status
- **Update Frequency**: Every 4 hours

#### Manual Tasks
- **Source**: Opus or Lawrence via Notion UI
- **Entry**: Direct creation in Notion Productivity Dashboard
- **Notion DB**: "Productivity Dashboard" (`b1721831-1a6c-4f5e-9c41-5488941abd4c`)
- **Properties**: Task Name, Status, Domain (School/Personal/Kairos), Due Date, Priority, Cycle
- **Update Frequency**: Real-time

### 1.2 Notion as External Buffer

**Key insight**: Notion is NOT the source of truth. It's a **collaborative interface** for:
- Lawrence to view tasks
- Agents to see assignments
- External partners (Amico, investors) to track progress

```
Local SQLite
     ↑↓
  (bi-directional sync)
     ↑↓
Notion DBs
     ↓
    (read-only)
     ↓
External Partners
```

### 1.3 Sync Protocol: Notion → Local SQLite

**Every 4 hours**, Codex runs `/notion/sync` endpoint:

```python
# Pseudocode
def sync_notion_to_local():
    # Query Notion DBs
    email_tasks = notion_api.query(
        db_id="bc4d2a87-93fd-43ae-bc4c-d4bbefca5838",
        filter={"property": "title", "rich_text": {"is_not_empty": true}},
        sort=[{"timestamp": "last_edited_time", "direction": "descending"}]
    )

    school_tasks = notion_api.query(
        db_id="309ed29a-2491-8000-a417-c0288ce2a9b6",
        filter={"property": "title", "rich_text": {"is_not_empty": true}},
        sort=[{"timestamp": "last_edited_time", "direction": "descending"}]
    )

    prod_tasks = notion_api.query(
        db_id="b1721831-1a6c-4f5e-9c41-5488941abd4c",
        filter={"property": "title", "rich_text": {"is_not_empty": true}},
        sort=[{"timestamp": "last_edited_time", "direction": "descending"}]
    )

    # Normalize to local schema
    local_tasks = normalize(email_tasks + school_tasks + prod_tasks)

    # Merge with existing local tasks
    for task in local_tasks:
        if exists_locally(task.id):
            update_local_task(task)
        else:
            insert_local_task(task)

    # Update TASKS.md
    update_tasks_md(local_tasks)

    # Update module_09 dashboard
    update_mission_control_json(local_tasks)

    return {"synced": len(local_tasks), "timestamp": now()}
```

**Database Properties Mapping**:

| Notion (Email DB) | Local SQLite | module_09 UI |
|-------------------|-------------|-------------|
| Task (title) | title | Task Name |
| Status | status | Status Badge |
| Due Date | due_date | Due |
| Priority | priority | Priority Level |
| Source | source | Email From |
| Notes | notes | Details |
| Email Link | source_url | Link |

---

## 2. Task Triage Pipeline

### 2.1 Opus's Daily Triage

Each morning, Opus:

1. **Reads latest Notion sync** (CLI: `curl /notion/sync`)
2. **Triages by urgency**:
   - Critical deadlines (today/tomorrow) → Inbox-top
   - High priority + this week → Next actions
   - Medium priority + this month → Backlog
   - Low priority → Someday
3. **Assigns agents** → writes to Command Post (Notion)
4. **Updates TASKS.md** → git push to main branch
5. **Writes daily brief** → Notion Command Post page

### 2.2 Triage Matrix

```
Deadline         Priority       Recommended Status       Assigned To
─────────────────────────────────────────────────────────────────────
Today/Tomorrow   Critical       Inbox (Top)             Opus + assigned agent
This Week        High           Doing (In Progress)     Assigned agent
This Month       Medium         Doing (Backlog)         Backlog queue
This Quarter     Low            Blocked (Someday)       Future sprint
Past Due         Any            Blocked (Waiting)       Opus (triage)
```

### 2.3 Status Lifecycle

Tasks move through states:

```
Inbox (new) → In Progress (assigned) → Blocked/Waiting (dependent) → Done (shipped)
```

**Status Definitions**:

| Status | Meaning | Next Action |
|--------|---------|-------------|
| **Inbox** | New, not triaged | Opus assigns priority |
| **Doing** | Actively worked on | Agent works, reports blockers |
| **Blocked** | Waiting on something | Escalate blocker |
| **Done** | Completed, shipped | Archive or close |
| **Waiting** | Dependent on other task | Track dependency |

---

## 3. Agent Assignment & Execution Pipeline

### 3.1 Spec → Implement → Review → Triage → Ship

```
┌─────────────────┐
│  Opus Writes    │
│  Detailed Spec  │
│  (handoff doc)  │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Sonnet/Codex   │
│  Implement      │
│  (write code)   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Antigravity     │
│ Reviews         │
│ (QA findings)   │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Opus Triages   │
│  Findings       │
│ (approve/rework)│
└────────┬────────┘
         ↓
   ┌─────┴─────┐
   ↓           ↓
 SHIP      REWORK
```

### 3.2 Handoff Document Format

**Location**: `module_09/handoffs/SPEC_<FEATURE>_<DATE>.md`

```markdown
# Spec: [Feature Name]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Technical Approach
- Architecture pattern
- Database schema
- API routes

## Database Schema (if applicable)
```sql
CREATE TABLE feature_table (
    id UUID PRIMARY KEY,
    ...
);
```

## API Contract (if applicable)
```
POST /api/feature
Request: {
    "field": "value"
}
Response: {
    "id": "uuid",
    "created_at": "timestamp"
}
```

## UI Wireframe (if applicable)
[ASCII art or description]

## Tests
- [ ] Unit test: X functionality
- [ ] Integration test: X flow
- [ ] Edge case: X error handling

## Success Criteria
- [ ] Feature works end-to-end
- [ ] Tests pass
- [ ] No security vulnerabilities
- [ ] Documentation complete
```

### 3.3 Review Report Format

**Antigravity writes to**: Same handoff doc, "Review Findings" section

```markdown
## Review Findings (by Antigravity)

### Summary
[Pass/Fail] | Overall Assessment

### Critical Findings (MUST FIX)
- [Bug 1]: Description, impact, suggested fix

### High Priority (Recommend Fix)
- [Issue 1]: Description, rationale

### Medium Priority (Can Defer)
- [Style 1]: Minor improvement suggestion

### Approval
- [ ] Pass — ready to ship
- [ ] Needs work — address findings and resubmit
```

### 3.4 Triage Decision

**Opus decides**:
- ✓ Approved → Ship to production
- ✗ Needs work → Sonnet/Codex address → resubmit to Antigravity

**Triage notes written to**: Handoff doc, "Triage Decision" section

---

## 4. module_09 Internal Data Flow

### 4.1 Desktop App Architecture

```
User Input (UI)
     ↓
React Component
     ↓
HTTP Request to FastAPI
     ↓
FastAPI Route Handler
     ↓
SQLAlchemy ORM
     ↓
SQLite Query
     ↓
Response JSON
     ↓
React State Update
     ↓
UI Render
```

### 4.2 Task Loading Flow (Example)

**User opens module_09 dashboard:**

```
1. React component mounts
2. useEffect triggers → GET /api/tasks
3. FastAPI route queries local SQLite
4. SQLAlchemy query:
   SELECT * FROM tasks
   WHERE status IN ('Inbox', 'Doing')
   ORDER BY priority DESC, due_date ASC
5. Return JSON to React
6. React updates state → Task list renders
```

### 4.3 Notion Sync Flow (Automated)

**Every 4 hours, FastAPI scheduler job runs:**

```
1. Scheduler trigger: 0 */4 * * * (every 4 hours)
2. FastAPI route: POST /notion/sync
3. Query Notion API (all 3 DBs)
4. Normalize to local schema
5. Merge with existing local tasks
6. Update SQLite
7. Generate TASKS.md
8. Regenerate mission_control.json
9. Log sync status
```

### 4.4 Local Inference Flow (Ollama)

**For classification/routing tasks:**

```
User message / Task input
     ↓
FastAPI receives POST /classify
     ↓
Send to local Ollama (not Claude API)
     ↓
Ollama (Gemma/Mistral) classifies
     ↓
Return classification (priority, domain, etc.)
     ↓
Update task metadata
     ↓
Route to correct agent
```

---

## 5. Kairos Data Flow

### 5.1 Voice-First Therapy Flow

```
User speaks (Audio)
     ↓
iOS records via AVAudioEngine
     ↓
Send to Claude API (whisper equivalent)
     ↓
Claude Haiku processes intent
     ↓
Generate therapy response
     ↓
Send to ElevenLabs TTS
     ↓
Stream audio back to user
```

### 5.2 Therapist Matching Flow

```
User completes intake form
     ↓
Store in local Core Data
     ↓
Background sync to Kairos backend
     ↓
Backend runs matching algorithm
     ↓
Claude API evaluates therapist fit
     ↓
Return ranked therapist list
     ↓
User selects → send booking to Calendly API
```

---

## 6. Communication Data Flow

### 6.1 Daily Brief Distribution

**Opus → Command Post → Lawrence**

```
Every morning:
1. Opus reads latest Notion sync
2. Opus triages tasks by urgency
3. Opus writes brief to Notion Command Post page:
   - Top priorities for today
   - Agent task assignments
   - Blockers and decisions needed
   - Business metrics
4. Lawrence checks Command Post (mobile or desktop)
5. Agents read Command Post for assignments
```

**Notion Command Post**: Page `88cc0a4b-af60-4953-b7e3-d71df005af3e`

### 6.2 Handoff Documentation

**Spec → Implementation → Review → Ship**

```
Opus writes to:           module_09/handoffs/SPEC_<NAME>_<DATE>.md
Sonnet/Codex read from:  same doc
Sonnet/Codex write to:   same doc (completion notes)
Antigravity reads from:  same doc
Antigravity writes to:   same doc (review findings)
Opus reads from:         same doc (triage decision)
```

### 6.3 Memory Persistence (CLAUDE.md)

**Opus updates weekly**:
- Agent roster and current status
- Product roadmap and feature backlog
- Brand architecture and naming conventions
- Key metrics and financial context
- Communication protocols and escalation paths

**All agents can read**: CLAUDE.md as context for their work

---

## 7. Error Handling & Data Integrity

### 7.1 Notion Sync Failures

**If Notion API fails:**

```
1. FastAPI logs error with timestamp
2. Schedule retry in 30 minutes
3. After 3 retries, alert Opus (Notion Command Post)
4. If persistent, fall back to manual sync
5. Data consistency: Local SQLite is source of truth (preserved)
```

### 7.2 Duplicate Task Prevention

**When syncing Notion → Local:**

```
Query Notion task ID → Check if exists in SQLite
  ├─ If exists → Update only changed fields
  └─ If new → Insert with unique ID
```

### 7.3 Audit Trail

**All changes logged**:
```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    table_name TEXT,
    record_id UUID,
    operation TEXT (INSERT/UPDATE/DELETE),
    changed_fields JSON,
    changed_by TEXT (agent name),
    changed_at TIMESTAMP
);
```

---

## 8. Data Model (SQLite Schema)

### Core Tables

```sql
-- Tasks (source of truth)
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT (Inbox, Doing, Blocked, Done),
    priority TEXT (Critical, High, Medium, Low),
    domain TEXT (School, Personal, Kairos),
    due_date TIMESTAMP,
    assigned_to TEXT (agent name),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    notion_sync_id TEXT (external reference)
);

-- Agents (roster)
CREATE TABLE agents (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE,
    role TEXT (Strategy, Execution, Quality, Research),
    model TEXT (Opus, Sonnet, GPT-4, Gemini, etc.),
    status TEXT (Active, Paused, Archived),
    lane_boundaries TEXT (JSON field)
);

-- Handoff Specs
CREATE TABLE handoffs (
    id UUID PRIMARY KEY,
    spec_name TEXT,
    assigned_to TEXT (agent),
    created_at TIMESTAMP,
    completed_at TIMESTAMP,
    status TEXT (Draft, In Review, Approved, Shipped),
    spec_content TEXT (markdown),
    review_findings TEXT (markdown)
);

-- Communication Log
CREATE TABLE comms (
    id UUID PRIMARY KEY,
    from_agent TEXT,
    to_agent TEXT,
    message_type TEXT (spec, brief, escalation, handoff),
    content TEXT,
    created_at TIMESTAMP,
    resolution_at TIMESTAMP (if escalation)
);
```

---

## 9. Disaster Recovery & Backups

### 9.1 SQLite Backups

```bash
# Daily automated backup
0 2 * * * sqlite3 local.db ".backup '/backups/local-$(date +%Y%m%d).db'"

# Weekly backup to Notion (archival)
0 3 * * 0 python scripts/backup_to_notion.py
```

### 9.2 Notion as Backup

Since Notion is synced, it serves as a **readable backup**:
- All tasks visible in Notion
- Can restore from Notion if SQLite is corrupted
- Bidirectional sync ensures consistency

---

## 10. API Endpoints (FastAPI)

### Task Management

```
GET    /api/tasks              - List all tasks
POST   /api/tasks              - Create task
PUT    /api/tasks/{id}         - Update task
DELETE /api/tasks/{id}         - Delete task
GET    /api/tasks/status/{s}   - Filter by status
```

### Notion Sync

```
POST   /notion/sync            - Full sync from Notion
GET    /notion/sync/status     - Check last sync
GET    /notion/tasks           - Get Notion tasks directly
```

### Agent Communication

```
POST   /agents/assign          - Assign task to agent
GET    /agents/status          - Get all agent statuses
POST   /agents/escalate        - Escalate blocker
```

### Inference (Local)

```
POST   /classify               - Classify task (Ollama)
POST   /summarize              - Summarize content (Ollama)
```

---

## 11. Security & Data Isolation

### 11.1 Local-First Principle

- Sensitive user data stays on SQLite (local machine)
- Only metadata syncs to Notion (external)
- API calls to Claude/ElevenLabs are transient (not stored)

### 11.2 Notion Token Management

- Notion internal integration token stored as environment variable
- Lawrence creates token at notion.so/my-integrations
- Codex accesses via `$NOTION_TOKEN` env var
- Never commit tokens to git

### 11.3 API Key Management

- Claude API key: `$CLAUDE_API_KEY`
- ElevenLabs API key: `$ELEVENLABS_API_KEY`
- All keys in `.env` (not in git)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SOURCES                         │
│  Email | Blackboard | Manual Creation | Messages (future)   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
        ┌────────────────────────┐
        │   ChatGPT / Atlas      │
        │ (Web Crawl & Ingest)   │
        └────────────┬───────────┘
                     ↓
        ┌────────────────────────┐
        │   Notion DBs (Buffer)  │
        │  • Email Action Items  │
        │  • MBA Tasks           │
        │  • Productivity DB     │
        └────────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │ Codex /notion/sync    │
         │ (Every 4 hours)       │
         └───────────┬───────────┘
                     ↓
        ┌────────────────────────┐
        │   LOCAL SQLite         │
        │ (Source of Truth)      │
        └────────────┬───────────┘
                     ↓
    ┌────────────────┼────────────────┐
    ↓                ↓                ↓
module_09         Kairos         Chaos Monk
(Desktop UI)    (iOS App)     (Dev Tools)
```

---

**Last Updated**: February 2026
**Maintained By**: Claude Cowork — Opus
**For Questions**: See agent-roles.md escalation paths
