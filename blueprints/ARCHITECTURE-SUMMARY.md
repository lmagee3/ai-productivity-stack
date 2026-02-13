# MAGE — AI Productivity Stack Architecture Summary

> Produced Feb 8, 2026 by Claude Cowork (Chief Executive AI) for cross-model handoff.
> Owner: Lawrence Magee | Company: Malleus Prendere

---

## 1) High-Level Overview

MAGE (Multi-Agent Generative Engine) is the operational nervous system for Malleus Prendere, a one-person AI-first company run by Lawrence Magee. The system ingests data from email inboxes and school LMS platforms, structures it into Notion databases, then syncs that data to local task files (TASKS.md) and three HTML dashboards (Mission Control, Productivity Board, Daily Brief). An executive AI agent (Claude Cowork) orchestrates prioritization, sprint management, and delegation to specialized AI agents (ChatGPT for code gen, Gemini for research, Copilot for IDE, Eve for PM). The system currently operates at v2 (semi-autonomous) with v3 (fully autonomous) in development under the internal codename "Project Leviathan."

**Key goals:**
- **Automation**: Eliminate Lawrence as data-transfer middleware between AI tools
- **Governance**: Every decision logged with timestamp and reasoning in TASKS.md
- **Cost discipline**: $2K total budget, free-tier services wherever possible, token-conscious prompting
- **Reliability**: Error recovery with exponential backoff, fallback patterns, graceful degradation

---

## 2) Current Tech Stack (Exact Components)

### Email
- **Gmail**: Personal inbox. Crawled by Claude Web App (browser extension). No direct API — parsed via browser automation.
- **Outlook**: School/work email (gl0balist.78@gmail.com Microsoft account). Currently accessed via Chrome browser bridge. Outlook MCP server built but shelved pending Azure app registration (needs Client ID). See `memory/context/outlook-mcp-handoff.md`.
- **School email**: Bellevue University notifications, crawled by Claude Web App.
- **Parsing approach**: Claude Web App reads emails in browser → extracts sender, subject, action items, deadlines, priority → pushes structured records to Notion.

### Task System
- **Notion** (two databases):
  - **Productivity Dashboard** — DB ID: `b1721831-1a6c-4f5e-9c41-5488941abd4c` — Properties: Task Name (title), Status (Inbox/Doing/Blocked/Done), Domain (School/Personal/Kairos), Due Date, Priority (High/Medium/Low), Cycle (Daily/Weekly/Monthly)
  - **Email Action Items** — DB ID: `bc4d2a87-93fd-43ae-bc4c-d4bbefca5838` — Properties: Task (title), Status (To Reply/To Review/To Follow Up/Waiting/In Progress/Completed/No Action), Due Date, Priority (Critical/High/Medium/Low), Source, Notes, Email Link
- **TASKS.md**: Local markdown file, ~100 lines, maintained by Claude Cowork. Sections: To Do/Today, Tomorrow/Next, In Progress, Done, Personal/Family, Upcoming, VA Claim, Later, Shelved, Blocked, Done history.

### Source-of-Truth Data Stores
- **Notion databases** (primary source of truth for structured task data)
- **TASKS.md** (execution-layer truth — what Claude Cowork tracks and updates)
- **CLAUDE.md** (session memory — people, projects, terms, pipeline config, Notion IDs)
- **memory/** directory (deep knowledge base — glossary, people files, project docs, architecture docs, brand architecture)

### Dashboards (3 HTML files, viewed in local browser)
1. **`dashboard.html`** (~1300 lines) — Kanban board. Reads TASKS.md dynamically via browser File Picker API. Board/List views + Memory tab. **Does NOT need data updates** — reads live from TASKS.md on refresh.
2. **`mission-control.html`** (~550 lines) — Sprint dashboard with Chart.js. Has hardcoded `TASKS` JavaScript array + `TODAY` date constant. Urgency scoring algorithm, multiple views (Overview, Sprint, Timeline, All Tasks). **Requires manual TASKS array update** each sync.
3. **`daily-brief.html`** (~290 lines) — Two-column layout. Left: news briefing (Markets, Geopolitics, Tech, Science, Pop Culture). Right: task checklist with checkbox interactivity + localStorage persistence. Browser notifications via Notification API + ntfy.sh push alerts. **Requires manual content update** each sync.

### Orchestration
- **Claude Cowork** (this agent): Manual trigger via user chat. Standing order: when Lawrence types "sync", update all 3 HTML dashboards + TASKS.md from Notion.
- **Claude Web App** (browser extension): Semi-automated. Lawrence triggers "wrap up and summarize" → Claude Web crawls inboxes + Blackboard → pushes structured data to Notion.
- **No cron, no GitHub Actions, no serverless scheduler currently.** All orchestration is conversation-triggered.
- **Target cadence**: Sync every 4 hours (not yet automated).

### Runtime Environment
- **Claude Cowork**: Runs in Cowork mode Linux VM (Ubuntu 22) on Lawrence's Mac. Has file system access to `Kairos/` workspace folder.
- **Claude Web App**: Runs as browser extension in Chrome.
- **Development**: Xcode on Mac (Kairos iOS app), terminal for Python/scripts.
- **No VPS, no Docker, no cloud functions currently.**

### Secrets Management
- **Notion API token**: Managed by Cowork's built-in Notion MCP connector (pre-authenticated).
- **GitHub PAT**: `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` — scopes: repo, user, delete:packages, read:packages. **Missing `delete_repo` scope.**
- **ElevenLabs API key**: Stored locally (free tier, 10K chars/month).
- **No 1Password, no Vault, no GitHub Secrets.** Secrets are environment variables or stored in local config files.

---

## 3) Agent/Module Map

| Agent | Purpose | Inputs | Outputs | Trigger | Model | Failure Handling |
|-------|---------|--------|---------|---------|-------|-----------------|
| **Claude Cowork** | Chief Executive AI — strategy, sprint management, Notion R/W, task triage, dashboard updates, daily briefs | Notion API data, TASKS.md, CLAUDE.md, memory files, user chat | Updated TASKS.md, updated HTML dashboards, strategic recommendations, status reports | Manual (user chat, "sync" command) | Claude Opus 4 (via Cowork mode) | Context recovery via session summaries + CLAUDE.md. Graceful degradation if Notion API fails. |
| **Claude Web App** | Data ingestion — crawls email inboxes + Blackboard LMS → structures data → pushes to Notion | Gmail inbox, Outlook inbox, Blackboard portal, school emails | Structured Notion database entries (Productivity Dashboard + Email Action Items) | Manual ("wrap up and summarize") | Claude Sonnet (browser extension) | Manual retry. No automated error recovery. |
| **ChatGPT** | Code generation — rapid prototyping, UI development, feature implementation | Task descriptions, architecture specs, code context | Generated code, test suggestions, implementation plans | Manual (Lawrence pastes context) | GPT-4 / GPT-4o | Manual iteration. Lawrence reviews and re-prompts. |
| **Gemini** | Research & analysis — market research, document analysis, competitive intelligence | Research questions, document URLs, analysis prompts | Structured research findings, summaries, recommendations | Manual (Lawrence delegates) | Gemini 1.5 Pro | Manual retry. Under evaluation for deeper pipeline integration. |
| **GitHub Copilot** | IDE assistance — real-time code suggestions in Xcode | Current code context, cursor position | Autocomplete suggestions, refactoring proposals | Automatic (IDE integration) | Copilot model | Falls back to manual coding. |
| **Eve** | Project management — task tracking UI | Task data from Lawrence | Task boards, timeline views | Manual (Lawrence uses PM tool) | N/A (PM tool, not LLM) | N/A |
| **Notion Sync Skill** | Bidirectional sync between Notion databases and local TASKS.md + dashboards | Notion API queries (both databases) | Updated TASKS.md sections, updated mission-control.html TASKS array | Triggered by Claude Cowork during "sync" | N/A (skill logic, not separate model) | Incremental diffing, exponential backoff on API failures, fallback search by database name if ID is stale, property name fallback mapping. |
| **Outlook MCP Server** | Native email access — search, read, triage, draft, send via Microsoft Graph API | User email queries, message IDs | Formatted email data, send confirmations | **SHELVED** — built, pending Azure app registration | N/A (MCP server) | Token refresh via MSAL cache, retry with backoff on 429/503, permission error messaging. |

---

## 4) Data Flow (Step-by-Step)

### Daily Run Pipeline (v2 — Semi-Autonomous)

```
1. INGESTION
   Lawrence triggers Claude Web App → "wrap up and summarize"
   Claude Web App crawls:
     - Gmail inbox (personal)
     - Outlook inbox (school/work)
     - Blackboard LMS portal (assignments, announcements)
     - School notification emails
   Extracts: sender, subject, action items, deadlines, priority, related projects

2. NORMALIZATION
   Claude Web App structures extracted data into Notion-compatible schema:
     - Task Name / Action Item (title)
     - Status (initial: Inbox / New)
     - Priority (Critical / High / Medium / Low)
     - Due Date (extracted from email or assignment)
     - Source (School / Personal)
     - Notes (context from email body)
     - Email Link (reference URL)

3. STORAGE
   Claude Web App pushes structured records to Notion via API:
     - Academic tasks → Productivity Dashboard (Domain: School)
     - Email action items → Email Action Items database
     - Deduplication: checks existing records before creating new ones

4. SYNC TRIGGER
   Lawrence types "sync" to Claude Cowork
   (Target: automated 4-hour schedule — not yet implemented)

5. PRIORITIZATION
   Claude Cowork queries both Notion databases via API
   Applies urgency scoring:
     - Deadline proximity (weight: high)
     - Blocker status (weight: high)
     - Dependency chains (weight: medium)
     - Business impact (weight: medium)
   Compares against current TASKS.md state
   Identifies: new items, changed statuses, completed items

6. TASK CREATION/UPDATE
   Claude Cowork updates TASKS.md:
     - Adds new tasks to appropriate sections
     - Moves completed items to Done
     - Updates priority markers (🔴 🟡 🟢)
     - Flags critical deadlines

7. DASHBOARD UPDATE
   Claude Cowork updates mission-control.html:
     - Sets TODAY date constant
     - Updates hardcoded TASKS JavaScript array
     - Recalculates urgency scores
   Claude Cowork updates daily-brief.html:
     - Updates news briefing content
     - Updates task checklist
   dashboard.html: No update needed (reads TASKS.md dynamically)

8. REPORT GENERATION
   Claude Cowork generates inline status report:
     - Today's priority stack
     - Upcoming deadlines
     - Blocked items
     - Sprint progress summary

9. NOTIFICATIONS
   daily-brief.html has browser Notification API integration
   ntfy.sh push alerts for critical deadlines
   (Not yet automated — triggered when user opens daily-brief.html)

10. LOGGING/AUDIT
    All decisions logged in TASKS.md with timestamps
    CLAUDE.md updated with session context
    Notion databases serve as persistent audit trail
    Dashboard staleness: flagged if last update > 5 hours old
```

---

## 5) Governance + Safety

### Automation Authority Matrix

| Decision Type | Authority | Examples |
|--------------|-----------|----------|
| **Operational** | AI autonomous | Task triage, status updates, dashboard refresh, brief generation, TASKS.md updates |
| **Tactical** | AI recommends, human confirms | Sprint priorities, content calendar, outreach targets, code architecture |
| **Strategic** | Human decides, AI advises | Funding direction, partnerships, pricing, hiring, legal |
| **Compliance** | Human required | Legal filings, financial transactions, account access, FDA submissions |
| **Destructive** | Human required | Deleting repos, sending emails, publishing content, modifying access controls |

### Guardrails
- **No automated email sending** — all email actions require Lawrence's explicit approval
- **No financial transactions** — budget tracking is advisory only
- **Draft-only for communications** — AI prepares drafts, Lawrence sends
- **Code review required** — AI-generated code reviewed before merge
- **Notion is inspectable** — Lawrence can view all database state at any time via Notion UI
- **No spend authority** — AI cannot make purchases or commit funds

### Audit Logs
- **TASKS.md**: Complete task lifecycle with timestamps (created, updated, completed)
- **CLAUDE.md**: Session memory — decisions made, context shifts, standing orders
- **Notion databases**: Full edit history via Notion's built-in versioning
- **mission-control.html**: TASKS array captures point-in-time sprint state

---

## 6) Cost Controls (Token Discipline)

### Current Approach
- **Summarize-first pattern**: Claude Web App extracts metadata from emails (not full bodies) before pushing to Notion. Only action items, deadlines, and key context are stored.
- **Incremental diffing**: Notion sync only processes changed records, not full database dumps. Reduces API calls by 70-90%.
- **Selective field queries**: Notion API queries use `filter_properties` to request only needed fields.
- **Free-tier services**: ElevenLabs free tier (10K chars/month), Notion free plan, GitHub free tier.
- **Model selection by task**: Haiku for Kairos chat (cheapest), Sonnet for code gen (fast), Opus for architecture (deep reasoning). Don't use Opus when Sonnet suffices.

### Token Management
- **CLAUDE.md is concise** (~120 lines) — avoids bloating context window
- **Memory files are modular** — only relevant files loaded per task (glossary, people, project-specific docs)
- **TASKS.md kept under 110 lines** — Done items archived periodically
- **No raw email bodies in Notion** — only extracted metadata and action items
- **Dashboard data is pre-computed** — baked into HTML, not re-generated from scratch each time

### Budget
- **Total MVP budget**: $2,000
- **Monthly AI costs**: ~$20-40 (Claude subscription, no API charges via Cowork mode)
- **Monthly services**: $0 (all free tiers)

---

## 7) Observability / Monitoring

### What Exists Today
- **TASKS.md diff**: Each sync compares current state against Notion, logging additions/changes
- **Dashboard staleness check**: If mission-control.html `TODAY` date is >24h old, flagged as stale
- **Notion API error logging**: Sync skill logs 400/401/404/429 errors with context and recovery steps
- **Session time tracking**: Standing order to flag when approaching Cowork daily usage limit

### Alerting Channels
- **ntfy.sh**: Push notifications for critical deadlines (configured in daily-brief.html)
- **Browser Notification API**: Alerts when daily-brief.html is open
- **In-chat alerts**: Claude Cowork flags issues directly in conversation

### Failure Detection
- **Notion API failures**: Logged with error code, attempted recovery, and fallback to search-by-name
- **Sync integrity**: Post-sync TASKS.md validated for proper markdown structure
- **Context loss**: Session summaries written to `.claude/` directory for recovery across context windows
- **No automated monitoring dashboard, no Datadog/Grafana, no PagerDuty**

---

## 8) Current Pain Points / Bottlenecks

### Data Heavy Lifting
- **mission-control.html updates are manual and brittle**: The entire TASKS JavaScript array must be rewritten each sync. No incremental update mechanism — full replacement every time.
- **daily-brief.html news content**: Requires web research + manual embedding. No automated news feed integration.
- **Context window pressure**: Long conversations with Opus hit context limits, triggering session compaction. Critical context can be lost across compactions despite CLAUDE.md.

### Latency/Cost Spikes
- **VM proxy blocks external APIs**: The Cowork Linux VM's proxy blocks direct access to api.github.com, requiring all GitHub operations to route through Chrome browser JavaScript. Adds ~2-3x latency per operation.
- **Large file operations via Chrome**: Pushing files to GitHub via browser fetch() is slow and error-prone. Base64 encoding + JS parameter limits cap file size per call.
- **Notion API rate limits**: 3 requests/second per bot token. Full sync of both databases can take 20-30 seconds.

### Brittleness
- **No automated scheduling**: All syncs are manual (conversation-triggered). If Lawrence doesn't type "sync," dashboards go stale.
- **Single point of failure**: Claude Cowork is the only agent that can update TASKS.md and dashboards. No redundancy.
- **Cross-session state**: Cowork sessions reset state. CLAUDE.md + memory/ files provide continuity, but new sessions must re-read all context.
- **No email automation**: Claude Web App requires Lawrence to trigger crawl. No webhook/push integration.
- **HTML dashboard updates are fragile**: Hardcoded JavaScript arrays in HTML files. One syntax error breaks the entire dashboard.

---

## 9) Expansion Targets (Next 30–60 days)

### Top 5 Automation Expansions (Priority: Family → Kairos → Health)

1. **Automated Notion Sync Schedule** — Implement cron-like trigger (GitHub Action, serverless function, or ntfy.sh webhook) to run sync every 4 hours without Lawrence typing "sync." Eliminates dashboard staleness.

2. **Outlook MCP Server Activation** — Complete Azure app registration, activate the already-built 12-tool MCP server. Gives Claude Cowork native email search/read/triage/draft without browser crawling. Immediate ROI: faster email processing, no Lawrence-as-middleware.

3. **LinkedIn Content Automation Skill** — Semi-autonomous content pipeline: AI curates relevant content → Notion approval queue → Lawrence approves → auto-posts to LinkedIn. Supports job search priority.

4. **Daily Brief Auto-Generation** — Replace manual news research with automated web search + summarization pipeline. daily-brief.html updated automatically each morning with market/tech/geopolitical summaries.

5. **Kairos MVP Demo Recording Pipeline** — Automated screen recording + walkthrough script generation for Amico demo (due Mar 6). AI prepares demo script, talking points, and slide deck.

### Top 5 Hardening Tasks

1. **Dashboard Template Engine** — Replace hardcoded JavaScript arrays with a template system. mission-control.html reads from a JSON data file instead of inline TASKS array. Eliminates syntax-error risk.

2. **Sync Idempotency Tests** — Write test cases for Notion sync: duplicate detection, property name fallbacks, rate limit handling, partial failure recovery. Currently untested.

3. **Session Continuity Protocol** — Formalize the context recovery process: what goes in CLAUDE.md vs memory/ vs session summaries. Add checksums for critical state files.

4. **GitHub PAT Rotation** — Current PAT is stored in plaintext across multiple files and conversation logs. Generate new PAT with proper scopes (`delete_repo` added), store securely, rotate old one.

5. **Approval Workflow for Destructive Actions** — Implement explicit confirmation gates for: email sending, repo deletion, Notion record deletion, public content publishing. Currently relies on conversational confirmation only.

---

## 10) Repo / File Map

### GitHub Repository
- **Profile**: https://github.com/lmagee3
- **Showcase repo**: https://github.com/lmagee3/ai-productivity-stack (public)
  - `README.md` — MAGE system documentation (pushed ✅)
  - `architecture.mermaid` — System architecture diagram (pushed ✅)
  - `.gitignore` — Standard ignores (pushed ✅)
  - `docs/autonomous-company-architecture.md` (pushed ✅)
  - `docs/data-flow.md` (pending push)
  - `docs/agent-roles.md` (pending push)
  - `docs/pipeline-architecture.md` (pending push)
  - `skills/notion-sync/SKILL.md` (pending push)
  - `skills/notion-sync/references/api_patterns.md` (pending push)
  - `skills/outlook-mcp/SPEC.md` (pending push)
- **Private repos**: `deep`, `kairos-mental-health`, `Kairos-v3`
- **Tutorial repos to delete (10)**: Expression-Converter-UML, forage-lyft-starter-repo, github-slideshow, Hello-Dave, hello-world, java-course, lawrance-magee-cv, PopSmoke, youtube-live-radio, _test_scope_check

### Local File System (`Kairos/` workspace)

```
Kairos/
├── CLAUDE.md                          # Session memory (people, projects, terms, config)
├── TASKS.md                           # Main task tracker (~107 lines)
├── dashboard.html                     # Kanban board (reads TASKS.md dynamically)
├── mission-control.html               # Sprint dashboard (Chart.js, hardcoded TASKS array)
├── daily-brief.html                   # News briefing + task checklist
├── github-handoff.md                  # GitHub cleanup handoff doc for other models
├── github-cleanup-commands.txt        # 6-step GitHub cleanup plan
├── github-bio.txt                     # Profile bio, company, location
├── ARCHITECTURE-SUMMARY.md            # THIS FILE
│
├── memory/
│   ├── glossary.md                    # Acronyms, codenames, tech terms
│   ├── people/
│   │   └── amico.md                   # Michael Amico / Konnectryx contact
│   ├── projects/
│   │   └── kairos.md                  # Kairos project details
│   └── context/
│       ├── company.md                 # Company vision + AI architecture layers
│       ├── pipeline-architecture.md   # v1→v2 pipeline docs, Notion schema, data flow
│       ├── autonomous-company-architecture.md  # Autonomous AI company framework
│       ├── brand-architecture.md      # Malleus Prendere / MAGE / Chaos Monk / Kairos
│       ├── notion-sync-prompt.md      # Notion sync skill prompt/instructions
│       ├── linkedin-content-automation-spec.md  # LinkedIn automation skill spec
│       └── outlook-mcp-handoff.md     # Outlook MCP server build spec (12 tools)
│
├── showcase-repo/                     # Files for ai-productivity-stack GitHub repo
│   ├── README.md
│   ├── architecture.mermaid
│   ├── .gitignore
│   ├── docs/
│   │   ├── data-flow.md
│   │   ├── agent-roles.md
│   │   ├── pipeline-architecture.md
│   │   └── autonomous-company-architecture.md
│   └── skills/
│       ├── notion-sync/
│       │   ├── SKILL.md
│       │   └── references/api_patterns.md
│       └── outlook-mcp/
│           └── SPEC.md
│
└── .skills/skills/                    # Active Cowork skills
    ├── notion-sync/                   # Notion sync skill (active)
    ├── skill-creator/                 # Skill creation tool
    ├── mcp-builder/                   # MCP server builder
    ├── canvas-design/                 # Visual design skill
    ├── xlsx/                          # Excel skill
    ├── pptx/                          # PowerPoint skill
    ├── pdf/                           # PDF skill
    └── docx/                          # Word doc skill
```

### Key Config
- **Notion Database IDs**: Stored in CLAUDE.md (Productivity: `b1721831...`, Email: `bc4d2a87...`)
- **Notion parent page IDs**: Stored in CLAUDE.md
- **GitHub PAT**: In `github-handoff.md` (needs rotation after cleanup)
- **Prompts/instructions**: In CLAUDE.md + memory/context/ files
- **Dashboards**: Root of Kairos/ folder (dashboard.html, mission-control.html, daily-brief.html)

---

## Standing Orders (Active)

1. **"sync" command**: When Lawrence types "sync" → query both Notion databases → update TASKS.md → update mission-control.html TASKS array + TODAY date → update daily-brief.html checklist + news → report summary.
2. **Session time tracking**: Flag when approaching daily usage limit so Lawrence can wrap up.
3. **Priority order**: Family first, then Kairos, then health/personal, then school, then job search.

---

*Document generated: Feb 8, 2026*
*For handoff to any AI model or human engineer. Contains all operational context needed to understand and extend the MAGE system.*
