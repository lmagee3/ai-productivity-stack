# module_09 Migration Checklist — Claude Code Takeover

**Date**: Feb 13, 2026
**Scope**: Full frontend takeover from Codex. Division of labor formalized Feb 12, 2026.
**Target**: Ship production-ready dashboard by Feb 28, 2026

---

## Current State Inventory

### Frontend (React + TypeScript + Vite)
- **Main entry**: `frontend/src/main.tsx` → `App.tsx`
- **Components**:
  - `App.tsx` — monolithic (~30KB estimated, file locked currently)
  - `DailyBrief.tsx` — news + task sections
  - `OverviewPanel.tsx` — attack order + chart rendering
  - `ScanModal.tsx` — stub (unused, decision pending)
  - `SettingsModal.tsx` — theme/dashboard toggles
- **Styling**: `styles.css` (unified, no component-scoped CSS)
- **Dependencies**: React 18.3, Chart.js 4.4.7, Tauri API 2.0
- **Build tool**: Vite, TypeScript strict mode enabled

### Backend (FastAPI + Python + SQLAlchemy)
- **Main app**: `backend/main.py` (FastAPI router registration)
- **Models**: Task, Notification, Chat, BrainDecision, LLM config, Blackboard task
- **Routes**: `/health`, `/status`, `/ops/next`, `/chat`, `/brain`, `/runtime/trigger`, `/files_scan`, `/news`, and more
- **Services**: Task ingest, automation runtime, priority ranking, execution policy
- **Database**: SQLite (`module_09.db`), Alembic migrations present
- **Scheduler**: Background automation runtime with scan/email/news jobs (10-60min intervals)

### Infrastructure (Tauri Desktop Shell)
- **Platform**: macOS/Windows/Linux (Rust shell wrapper)
- **Build**: `shell/dev-one.sh` for unified dev, `shell/dev-backend.sh` for backend-only
- **Run script**: `./run.sh` launches backend + frontend in parallel
- **Health check**: `shell/healthcheck.sh`, `shell/status.sh`

### Blueprints (Reference HTML/CSS)
- `blueprints/mission-control.html` — full dashboard layout (charts, metrics, attack order)
- `blueprints/daily-brief.html` — two-column task/news briefing
- `blueprints/dashboard.html` — (exists, not yet reviewed)

### Design System
- **Theme**: Dark-first (CRT, light, dark modes supported)
- **Colors**: Gradients (purple: #a78bfa → #7c3aed), danger red (#ef4444), warning yellow (#fbbf24), accent cyan (#22d3ee)
- **Grid**: 12-column layout for desktop, responsive down to mobile
- **Fonts**: Inter (fallback: system sans-serif)
- **Components**: Cards (bordered, dark bg), badges, doughnut charts, bar charts, metric cards

---

## Phase 0: Immediate (This Session)

### [ ] Inventory Current State
**Status**: IN PROGRESS (this doc is the inventory)
**Owner**: [Cowork-Opus]

- [x] Frontend file structure documented
- [x] Backend routes + services mapped
- [x] Dependencies identified
- [x] Blueprints reviewed
- [x] Previous backbrief (Feb 12) read
- [ ] TODO: Run frontend in dev mode to verify current state (file lock issue may prevent this)

**Notes**: Frontend source files have resource lock issue (EDEADLK). May need restart or file permissions fix. Check `/sessions/trusting-inspiring-ride/mnt/Kairos/module_09/frontend/src/App.tsx` status.

---

### [ ] Create Migration Checklist
**Status**: DONE
**Owner**: [Cowork-Opus]

This document. Published to `/sessions/trusting-inspiring-ride/mnt/Kairos/module_09/MIGRATION_CHECKLIST.md`.

---

### [ ] Establish Dev Workflow for Claude Code
**Status**: PENDING
**Owner**: [Cowork-Opus]

**Workflow Definition**:
- **Opus (This session)**: Architecture decisions, component design, integration specs, UI/UX authority, reviews
- **Sonnet (Future sessions)**: CSS refactoring, bulk renames, test writing, mechanical changes (save tokens)
- **Codex (Parallel)**: Backend infrastructure, routes, DB, scheduler (per Feb 13 handoff)
- **Lawrence**: Human-in-the-loop on org/funding decisions, final approvals on feature scope

**Handoff Protocol**:
1. Cowork-Opus writes spec (component architecture, props interface, API contract)
2. Sonnet or Opus implements (depends on complexity)
3. Codex provides backend endpoints (if needed)
4. Opus reviews, merges, escalates blockers

**Rule**: If it requires a decision (UI, arch, scope), Opus handles it. If it's grind work (lint, format, tests), Sonnet takes it.

**Dev Workflow Checklist**:
- [ ] Frontend dev server runs cleanly (`npm run dev` from `frontend/` directory)
- [ ] Hot reload works (edit a file, see instant refresh)
- [ ] TypeScript compilation passes with `tsc -b` (strict mode)
- [ ] Backend API available at `http://localhost:8000` (check `/health`)
- [ ] Chart.js renders in browser console (no errors)
- [ ] API key header (`X-API-Key: MAGE-local-v.1`) accepted by backend

---

## Phase 1: Frontend Takeover (Sprint 1 — Feb 14-17)

### [ ] Break App.tsx Monolith
**Status**: NOT STARTED
**Owner**: [Cowork-Opus]
**Time Estimate**: 4-6 hours

**Goal**: Extract `App.tsx` into proper component tree (currently ~30KB single file).

**Steps**:
1. **Read full App.tsx** (unblock file lock issue first if needed)
2. **Map component boundaries**:
   - Identify sections that should be separate components (header, sidebar, main panels, modals)
   - Identify shared state / props flowing down
   - Identify re-render triggers (is the whole tree re-rendering on every API response?)
3. **Propose component tree**:
   - `App` → top-level router + state (theme, sidebar open/close, active panel)
   - `Header` → branding, sync status, weather, time
   - `Sidebar` → nav tabs (Overview, Daily Brief, Chat, Settings)
   - `MainPanel` → active view container
   - `OverviewPanel` → attack order + charts (currently component, good)
   - `DailyBrief` → news + tasks (currently component, good)
   - `ChatPanel` → conversation + input (new or refactored)
   - `SettingsModal` → (currently component, good)
4. **Extract to separate files**:
   - `src/components/Header.tsx`
   - `src/components/Sidebar.tsx`
   - `src/components/MainPanel.tsx`
   - `src/features/overview/OverviewPanel.tsx` (existing, may need refactor)
   - `src/features/brief/DailyBrief.tsx` (existing, may need refactor)
   - `src/features/chat/ChatPanel.tsx` (new or refactored)
5. **Update App.tsx** to wire the tree with proper state lifting
6. **Verify TypeScript**: All components have full type coverage (no `any` or implicit `unknown`)

**Deliverable**: `App.tsx` < 300 LOC, clear component hierarchy, all types explicit.

**Acceptance Criteria**:
- [x] Component tree diagram documented in a comment block at top of `App.tsx`
- [x] No circular imports
- [x] `tsc -b` passes without errors
- [x] All props interfaces exported and documented

---

### [ ] Add Missing TypeScript Types/Interfaces
**Status**: NOT STARTED
**Owner**: [Cowork-Opus]
**Time Estimate**: 2-3 hours

**Goal**: Eliminate type gaps in frontend codebase (strict mode enabled, but some files may have implicit types).

**Steps**:
1. **Audit types across files**:
   - `App.tsx` — verify all state and event handlers typed
   - `DailyBrief.tsx` — ensure task list shape is typed
   - `OverviewPanel.tsx` — ensure chart data structures are typed
   - `SettingsModal.tsx` — ensure settings object shape is typed
   - `api/client.ts` — ensure API response types are complete
   - `health.ts`, `ops.ts`, `chat.ts` — ensure return types documented
2. **Create `src/types/index.ts`** with exported interfaces:
   ```typescript
   // Core domain types
   export interface Task {
     id: string;
     title: string;
     status: 'inbox' | 'doing' | 'blocked' | 'done';
     domain: 'kairos' | 'school' | 'personal' | null;
     priority: 'high' | 'medium' | 'low';
     dueDate: Date | null;
     sourceDb?: 'productivity' | 'email';
   }

   export interface NotionSyncStatus {
     syncedAt: Date;
     count: number;
     error: string | null;
   }

   export interface APIResponse<T> {
     data: T;
     meta?: Record<string, unknown>;
   }

   export interface ChatMessage {
     role: 'user' | 'assistant';
     content: string;
     timestamp: Date;
   }

   // Component prop types
   export interface HeaderProps { ... }
   export interface SidebarProps { ... }
   // etc.
   ```
3. **Replace implicit types** in all components with explicit interfaces
4. **Document complex shapes** as JSDoc comments above interfaces

**Deliverable**: `src/types/index.ts` with 15+ exported interfaces, zero `any` types in codebase.

**Acceptance Criteria**:
- [x] `npm run build` produces zero type errors
- [x] All API response shapes documented
- [x] All component props typed with exported interfaces
- [x] JSDoc comments on complex types

---

### [ ] Create Test Infrastructure
**Status**: NOT STARTED
**Owner**: [Cowork-Opus]
**Time Estimate**: 3-4 hours

**Goal**: Set up testing framework and write first batch of unit tests. Currently zero tests exist.

**Steps**:
1. **Install testing dependencies**:
   ```bash
   cd frontend
   npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
   ```
2. **Create test config**:
   - `frontend/vitest.config.ts` (minimal Vite-aware setup)
   - `frontend/src/vitest.setup.ts` (global test setup)
3. **Create test files** (one per component):
   - `src/components/__tests__/Header.test.tsx`
   - `src/components/__tests__/Sidebar.test.tsx`
   - `src/features/overview/__tests__/OverviewPanel.test.tsx`
   - `src/features/brief/__tests__/DailyBrief.test.tsx`
   - `src/api/__tests__/client.test.ts`
4. **Write test cases** (focus on critical paths):
   - Component rendering (smoke test)
   - Event handlers (click, input change)
   - Conditional rendering (theme changes, modal open/close)
   - API calls (mock responses, error handling)
5. **Update `package.json` scripts**:
   ```json
   {
     "test": "vitest",
     "test:ui": "vitest --ui",
     "coverage": "vitest --coverage"
   }
   ```
6. **Add test script to CI** (if applicable)

**Deliverable**: 10+ tests passing, CI configured to run on commit.

**Acceptance Criteria**:
- [x] `npm test` runs without errors
- [x] Coverage > 50% for frontend code
- [x] Critical user paths covered (theme toggle, sidebar nav, chart render)

---

### [ ] Verify Chart.js Rendering
**Status**: BLOCKED (depends on App.tsx readability)
**Owner**: [Cowork-Opus]
**Time Estimate**: 1 hour

**Goal**: Confirm Chart.js renders all charts correctly (status doughnut, source doughnut, focus bar).

**Steps**:
1. **Start frontend dev server**: `npm run dev` from `frontend/` directory
2. **Open browser console** (F12), check for Chart.js errors
3. **Navigate to Overview panel** and verify:
   - Status doughnut chart renders (done/doing/blocked/inbox counts)
   - Source doughnut chart renders (productivity/email task split)
   - Focus bar chart renders (weekly burndown or task distribution)
4. **Check chart data**:
   - Inspect DOM to verify canvas elements exist
   - Check network tab for API calls to `/notion/tasks` (should return task data once backend Notion sync is implemented)
5. **Test responsive behavior**:
   - Resize window, verify charts reflow (not overflow)
   - Check mobile view (if applicable)
6. **Log any errors** to backbrief if charts fail

**Deliverable**: All three charts render without console errors.

**Acceptance Criteria**:
- [x] No Chart.js errors in browser console
- [x] All three chart canvases render
- [x] Charts update when data changes (API refresh)
- [x] Charts scale correctly on resize

---

### [ ] ScanModal Decision
**Status**: DECISION PENDING
**Owner**: [Cowork-Opus]
**Time Estimate**: 30 min

**Goal**: Decide: build or remove `ScanModal.tsx` (currently a stub).

**Context**:
- File exists at `src/components/ScanModal.tsx` (stub implementation)
- Backend has file scanning routes (`/files_scan`) with automated scheduler
- Frontend doesn't currently display scan results in a modal

**Decision Tree**:
1. **Build (if scan modal adds value)**:
   - Show real-time file scan progress
   - Display scan results as clickable file links
   - Add pause/resume controls
   - Cost: ~4 hours frontend + backend integration
2. **Remove (if scan is backend-only)**:
   - Scan results flow into task ingest, not user-facing
   - No need for modal UI
   - Cost: Delete file, update App.tsx
   - Benefit: Reduce surface area, cleaner codebase

**Recommendation**: **REMOVE** (pending Lawrence confirmation). Scan is an automated background job. Results surface as tasks in Daily Brief and Attack Order. No need for dedicated modal.

**Action**:
- [ ] If REMOVE: Delete `src/components/ScanModal.tsx`, remove from imports/render in `App.tsx`
- [ ] If BUILD: Write spec for ScanModal component, add to Phase 1.5 backlog

**Deliverable**: Clear decision documented in backbrief.

---

### [ ] Pixel-Perfect Audit vs. HTML Blueprints
**Status**: NOT STARTED
**Owner**: [Cowork-Opus]
**Time Estimate**: 3-4 hours

**Goal**: Compare current React UI to reference blueprints. Document gaps. Prioritize fixes.

**Blueprints to Audit**:
1. **mission-control.html**:
   - Header layout (title, sync btn, time/weather)
   - Metric cards (4-column grid)
   - Chart cards (status, source, focus)
   - Attack order with priority badges
   - Inline alerts (overdue, due-today styling)
2. **daily-brief.html**:
   - Two-column layout (news left, tasks right)
   - Stats bar (4 metrics)
   - News tabs + content
   - Task checklist with badges
   - Report button + output
3. **dashboard.html**:
   - (TBD — review content if exists)

**Audit Checklist**:
- [ ] Layout matches blueprint (grid, spacing, responsive breakpoints)
- [ ] Colors match (use CSS variables, not hardcoded hex)
- [ ] Typography matches (font weights, sizes, line heights)
- [ ] Interactive states match (hover, active, disabled, loading)
- [ ] Theme switching works (dark/light/CRT all render correctly)
- [ ] Modals overlay correctly (z-index, backdrop)
- [ ] Charts render with correct data labels and colors
- [ ] Badges/badges render with correct colors for priority/status
- [ ] Empty states handled (no data → show placeholder, not blank)

**Gap Categories**:
- **Visual**: Colors, spacing, shadows, borders → CSS-only fixes
- **Layout**: Grid/flex changes → refactor component layout
- **Content**: Missing sections → add UI components
- **Interaction**: Missing handlers → wire up event handlers
- **Data**: Hardcoded → wire to API

**Deliverable**: Audit document listing all gaps with priority (critical/high/medium/low) and owner assignment.

**Acceptance Criteria**:
- [x] All critical gaps documented
- [x] Each gap has a fix proposal (CSS, layout, data, or component)
- [x] Gaps prioritized for Phase 2-3

---

## Phase 2: Integration Layer (Sprint 2 — Feb 18-21)

### [ ] Wire Notion Data to Frontend (Post-Codex Backend)
**Status**: BLOCKED (awaiting Codex Notion backend completion)
**Owner**: [Cowork-Opus]
**Time Estimate**: 3-4 hours

**Goal**: Connect frontend OverviewPanel and DailyBrief to Notion task data via backend `/notion/tasks` endpoint.

**Prerequisite**: Codex must complete Task 1 (Notion backend integration) in handoff. Check for:
- [ ] `/notion/sync` endpoint exists and returns 200
- [ ] `/notion/tasks` endpoint exists, returns task list
- [ ] All filter types work: `?status=doing`, `?domain=kairos`, `?priority=high`, `?source_db=email`

**Steps**:
1. **Update API client** (`src/api/client.ts`):
   ```typescript
   export async function fetchNotionTasks(filters?: {
     status?: string;
     domain?: string;
     priority?: string;
     sourceDb?: string;
   }): Promise<Task[]> {
     // Hit GET /notion/tasks with filters as query params
   }

   export async function triggerNotionSync(): Promise<{syncedAt: Date; count: number}> {
     // Hit POST /notion/sync
   }
   ```
2. **Update OverviewPanel** (`src/features/overview/OverviewPanel.tsx`):
   - Replace mock task data with `fetchNotionTasks()` call
   - Add refresh button (manual trigger to `/notion/sync`)
   - Display sync timestamp (`meta.synced_at`)
   - Update charts with live data (status distribution, source split, focus trends)
3. **Update DailyBrief** (`src/features/brief/DailyBrief.tsx`):
   - Fetch tasks and group by due date (today, tomorrow, this week, overdue)
   - Render task list with correct priority badges and domain tags
   - Add checkbox state management (persist to backend if needed)
4. **Add sync indicator** to Header:
   - Show last sync time
   - Show task count
   - Add "Sync Now" button (manual trigger)
5. **Error handling**:
   - If API down: show offline indicator, use cached data (localStorage fallback)
   - If Notion API error (rate limit, bad token): show banner with retry button
6. **Polling/refresh interval**:
   - Auto-refresh every 4-30 seconds (TBD based on API limits)
   - Stagger requests to avoid thundering herd

**Deliverable**: Live Notion data flowing from backend to frontend, charts update in real-time.

**Acceptance Criteria**:
- [x] OverviewPanel displays Notion tasks (count, distribution, priority)
- [x] DailyBrief displays tasks grouped by due date
- [x] Sync button manually triggers `/notion/sync`
- [x] Error states handled gracefully (offline, API error, rate limit)
- [x] Charts update without full page reload
- [x] No TypeScript errors

---

### [ ] Connect /notion/tasks to Attack Order
**Status**: BLOCKED
**Owner**: [Cowork-Opus]
**Time Estimate**: 2-3 hours

**Goal**: OverviewPanel's attack order section now pulls live priority-ranked tasks from Notion.

**Steps**:
1. **Fetch filtered tasks**: `fetchNotionTasks({status: 'doing,inbox'})` (high-priority statuses)
2. **Sort by priority**: High → Medium → Low (use priority field from Notion)
3. **Rank by urgency**:
   - Overdue tasks → rank 1 (red)
   - Due today → rank 2 (orange)
   - Due this week → rank 3 (yellow)
   - Due later → rank 4 (gray)
4. **Render attack order**:
   - Rank badge (1-4 or infinity)
   - Task title
   - Domain tag (kairos/school/personal/jobsearch)
   - Due date + time
   - Hover: expand to show full description or notes
5. **Interactive features**:
   - Click to open task detail
   - Checkbox to mark done (calls backend to update status)
   - Drag to reorder (optional, advanced)

**Deliverable**: Attack order section now displays live Notion tasks, ranked by urgency.

**Acceptance Criteria**:
- [x] Tasks sorted by priority and urgency
- [x] Rank badges color-coded correctly
- [x] Domain tags visible
- [x] Due dates displayed
- [x] Checkbox functionality works (if persisting back to Notion)

---

### [ ] Add Notion Sync Status Indicator
**Status**: BLOCKED
**Owner**: [Cowork-Sonnet]
**Time Estimate**: 1 hour

**Goal**: Header displays when Notion sync last ran and result status (success/error/pending).

**Steps**:
1. **Add state to Header**:
   - `syncStatus` (enum: 'idle' | 'syncing' | 'success' | 'error')
   - `syncedAt` (timestamp)
   - `syncError` (error message if failed)
2. **Fetch sync status** from backend:
   - Hit `/status` endpoint (already exists, returns `runtime` telemetry)
   - Extract `sync_last_run` and `sync_last_error` fields
3. **Visual indicator**:
   - Syncing: spinning loader icon
   - Success: green check + timestamp ("Synced 2 min ago")
   - Error: red warning + error message ("Notion API error: rate limit exceeded")
   - Idle: gray dot
4. **Auto-refresh**: Poll `/status` every 10 seconds (or subscribe to events)

**Deliverable**: Visual sync status in header, updates in real-time.

**Acceptance Criteria**:
- [x] Sync status reflected in header
- [x] Timestamp displayed
- [x] Error state shows error message
- [x] Polling works without blocking UI

---

### [ ] Update DailyBrief Task Groups (Post-Notion Integration)
**Status**: BLOCKED
**Owner**: [Cowork-Opus]
**Time Estimate**: 2-3 hours

**Goal**: DailyBrief task sections now pull from Notion and group correctly (Today, Tomorrow, This Week, Overdue).

**Prerequisites**: Notion integration complete, task data flowing to frontend.

**Steps**:
1. **Refactor task grouping logic**:
   - `getOverdueTasks()` → tasks with dueDate < today
   - `getTodayTasks()` → tasks with dueDate == today
   - `getTomorrowTasks()` → tasks with dueDate == tomorrow
   - `getThisWeekTasks()` → tasks with dueDate between tomorrow+1 and nextSunday
2. **Update DailyBrief** to display groups in order:
   - Overdue (red alert badge)
   - Today's Attack Order (top priority section)
   - Tomorrow
   - This Week
3. **Task item rendering**:
   - Title + domain tag
   - Priority dot (color-coded)
   - Checkbox (toggles task status if backend supports)
   - Due date + time
4. **Styling**:
   - Overdue tasks: red left border, dimmed background
   - Today tasks: orange/yellow border, highlighted
   - Future tasks: normal styling
5. **Empty states**:
   - If no tasks in a group, hide section (or show "No tasks" placeholder)

**Deliverable**: DailyBrief displays live Notion tasks grouped by due date.

**Acceptance Criteria**:
- [x] All tasks displayed in correct group
- [x] Overdue tasks highlighted with alert styling
- [x] Today's tasks prioritized (rank badges visible)
- [x] Checkbox updates task status (if backend supports)

---

## Phase 3: Polish & Ship (Sprint 3 — Feb 22-28)

### [ ] Theme System Verification
**Status**: NOT STARTED
**Owner**: [Cowork-Sonnet]
**Time Estimate**: 2 hours

**Goal**: Confirm dark/light/CRT themes all render correctly. No missing colors, no hardcoded hex values.

**Steps**:
1. **Audit CSS for hardcoded colors**:
   - Grep for `#[0-9a-f]{3,6}`, `rgb(`, `hsl(`
   - Replace all with CSS custom properties: `var(--color-name)`
2. **Define color palette** in `src/styles.css`:
   ```css
   [data-theme="dark"] {
     --bg-primary: #0a0a0f;
     --bg-secondary: #111118;
     --text-primary: #e5e7eb;
     --text-secondary: #6b7280;
     --border: #1e1e2e;
     --accent-purple: #a78bfa;
     /* ... more colors ... */
   }

   [data-theme="light"] {
     --bg-primary: #ffffff;
     /* ... light theme colors ... */
   }

   [data-theme="crt"] {
     --bg-primary: #000000;
     /* ... CRT colors (green monochrome?) ... */
   }
   ```
3. **Test theme switching**:
   - Click Settings → Theme selector
   - Switch between Dark / Light / CRT
   - Verify all components repaint correctly
   - No flickering or color mismatches
4. **Verify in all contexts**:
   - Header, sidebar, main panels, modals, charts, alerts
   - Hover states, active states, disabled states

**Deliverable**: All UI renders correctly in all three themes. No hardcoded colors.

**Acceptance Criteria**:
- [x] All colors use CSS custom properties
- [x] Dark theme loads by default
- [x] Theme switch instant (no reload)
- [x] No color overflow or overflow text in any theme

---

### [ ] Performance Audit
**Status**: NOT STARTED
**Owner**: [Cowork-Opus]
**Time Estimate**: 2-3 hours

**Goal**: Verify API call cadence, re-render performance, and memory usage are acceptable.

**Context**: Frontend currently polls APIs every 4-30 seconds. Goal: validate this doesn't cause lag or battery drain.

**Steps**:
1. **Profile API calls**:
   - Open browser DevTools → Network tab
   - Start app, leave running for 5 minutes
   - Count API calls (should be ~10-15 calls per minute, not 100+)
   - Check call cadence: `/health`, `/status`, `/notion/tasks`, `/news` (all staggered)
   - Check response size: ensure not loading 100MB of data
2. **Profile rendering**:
   - Open DevTools → Performance tab
   - Trigger a data refresh (sync button or auto-refresh)
   - Record for 10 seconds
   - Look for "long tasks" (> 50ms without interruption)
   - Identify bottlenecks (Chart.js redraw? DOM thrashing?)
3. **Check re-renders**:
   - Add React DevTools Profiler
   - Interact with UI (theme switch, sidebar nav, modal open)
   - Verify components only re-render when necessary (not entire tree)
4. **Memory usage**:
   - Leave app running for 10 minutes
   - Check DevTools → Memory tab
   - Heap should stabilize (not grow indefinitely)
   - No detached DOM nodes or memory leaks
5. **Performance budget**:
   - Target: Full page render < 100ms
   - Target: Chart update < 200ms
   - Target: API latency < 500ms (backend dependent)

**Deliverable**: Performance report with metrics and optimization recommendations.

**Acceptance Criteria**:
- [x] No memory leaks (heap stabilizes)
- [x] No unnecessary re-renders (React Profiler check)
- [x] API calls staggered (not thundering herd)
- [x] Load time < 5 seconds from cold start

---

### [ ] Error Handling Improvements
**Status**: NOT STARTED
**Owner**: [Cowork-Sonnet]
**Time Estimate**: 2-3 hours

**Goal**: Add user-facing error messages and recovery options. Currently limited error handling.

**Steps**:
1. **Identify error scenarios**:
   - Backend unreachable (API down, network error)
   - Notion API error (rate limit, bad token, permission denied)
   - Invalid theme selection (malformed data)
   - Chart rendering failure (bad data, Chart.js error)
2. **Create error boundary component** (`src/components/ErrorBoundary.tsx`):
   - Wrap App with ErrorBoundary
   - Catch React errors and display fallback UI
   - Log to backend for debugging
3. **Add error alerts**:
   - Top-of-page banner for transient errors (retry button)
   - Modal for blocking errors (requires action)
   - Inline errors for form validation
4. **Provide recovery options**:
   - "Retry" button on network errors
   - "Dismiss" button on warnings
   - "Clear cache" option if data stale
   - "Report error" link to GitHub issues
5. **Graceful degradation**:
   - If Notion API down: show cached data with "offline" indicator
   - If chart fails: show data table instead
   - If news feed down: show placeholder ("News unavailable")

**Deliverable**: Comprehensive error handling throughout UI. Users know what went wrong and how to fix it.

**Acceptance Criteria**:
- [x] All error states have a message
- [x] All error messages include a recovery action
- [x] No silent failures (user always knows if something failed)
- [x] Error boundary catches React errors

---

### [ ] Responsive Layout Check
**Status**: NOT STARTED
**Owner**: [Cowork-Sonnet]
**Time Estimate**: 2 hours

**Goal**: Verify UI renders correctly on mobile (< 768px), tablet (768-1024px), and desktop (> 1024px).

**Steps**:
1. **Test breakpoints**:
   - Desktop (1920px): all columns visible, full charts
   - Tablet (1024px): 2-column layout, smaller charts
   - Mobile (375px): 1-column stacked layout, collapsed sidebar
2. **Check specific elements**:
   - Header: branding visible, buttons accessible
   - Sidebar: hamburger menu on mobile, visible on desktop
   - Main panels: no horizontal scroll, text readable
   - Charts: render correctly (not squeezed or cut off)
   - Modals: full screen on mobile, centered on desktop
   - Forms: input fields large enough to tap (44px minimum)
3. **Test interactions**:
   - Sidebar toggle works on mobile
   - Dropdowns don't overflow viewport
   - Modal close button accessible
   - Scrolling smooth (no jank)
4. **Device testing**:
   - Chrome DevTools (mobile emulation)
   - Firefox Responsive Design Mode
   - Real device if available (iPhone, Android)

**Deliverable**: UI renders and functions correctly on all viewport sizes.

**Acceptance Criteria**:
- [x] No horizontal scroll on any breakpoint
- [x] No text overflow or truncation issues
- [x] Touch targets ≥ 44px
- [x] Mobile sidebar toggle works

---

### [ ] Final Blueprint Comparison
**Status**: NOT STARTED
**Owner**: [Cowork-Opus]
**Time Estimate**: 2-3 hours

**Goal**: Final pass comparing current React UI to reference blueprints. Document any remaining gaps.

**Steps**:
1. **Side-by-side comparison**:
   - Open blueprint HTML in one browser tab
   - Open React app in another tab
   - Systematically compare each section
2. **Document gaps** (if any):
   - Visual mismatches (color, spacing, typography)
   - Layout mismatches (grid, alignment, responsive behavior)
   - Interaction mismatches (hover states, animations)
   - Content mismatches (missing sections, extra sections)
3. **Prioritize fixes**:
   - Critical: breaks layout or hides important info
   - High: visually jarring but functional
   - Medium: cosmetic (nice to have)
4. **Quick fixes**:
   - If CSS-only → apply directly
   - If component refactor → add to future backlog
5. **Sign-off**: Confirm with Lawrence if visual parity acceptable

**Deliverable**: Final audit document or "Blueprint Parity Verified" sign-off.

**Acceptance Criteria**:
- [x] All critical and high-priority gaps addressed
- [x] Blueprint comparison documented
- [x] Remaining gaps (if any) justified and backlogged

---

## Codex Handoffs (Parallel Track)

### [ ] Task 1: Notion Backend Integration
**Status**: IN PROGRESS (Codex owns)
**Owner**: [Codex]
**Due**: Feb 15, 2026

**Spec**: `handoffs/notion-integration-spec.md` (full detail)

**Acceptance**:
- [ ] `/notion/sync` endpoint returns 200, syncs tasks
- [ ] `/notion/tasks` endpoint filters by status, domain, priority, source_db
- [ ] Scheduler runs every 4 hours
- [ ] Notion API errors handled gracefully
- [ ] 50+ tasks synced and deduplicated

**Blocking**: Codex must finish before Phase 2 starts (frontend integration).

---

### [ ] Task 2: GitHub Restoration
**Status**: PENDING (Codex owns)
**Owner**: [Codex]
**Due**: Feb 16, 2026

**Spec**: Push README + 6 docs, update bio, pin repo, delete tutorial repos.

---

### [ ] Task 3: Backbrief
**Status**: PENDING (Codex owns)
**Owner**: [Codex]
**Due**: Feb 17, 2026

**Template**: `handoffs/CODEX_BACKBRIEF_2026-02-13.md` (includes test results, blockers, notes).

---

## Dev Workflow & Communication

### Code Review Cycle
1. **Opus writes spec** → Posted in backbrief or code comments
2. **Sonnet or Opus implements** → Pushed to branch
3. **Codex implements backend** (if needed) → Posts backbrief
4. **Opus reviews** → Approves or requests changes
5. **Merge to main** → Ready for testing

### Escalation Protocol
- **Product/UX question**: Escalate to Cowork-Opus immediately
- **Backend blocker**: Ask Codex for ETA or spec clarification
- **Performance issue**: Measure, document, prioritize for Phase 3
- **Scope creep**: Flag to Lawrence for priority override

### Daily Standup (Virtual)
- Opus: Update on Phase 1 progress, blockers
- Sonnet: CSS/test progress
- Codex: Backend progress, API readiness
- Lawrence: Org decisions, unblocks

### Commit Message Style
```
[Phase 1] Break App.tsx monolith into components

- Extract Header, Sidebar, MainPanel components
- All TypeScript types explicit (no any)
- Component tree documented in App.tsx comments

Fixes #12
```

---

## Success Criteria (Overall)

By Feb 28:
- [ ] Frontend fully migrated from Codex to Claude Code (Opus + Sonnet)
- [ ] App.tsx refactored into proper component tree
- [ ] All TypeScript strict mode passing
- [ ] Test infrastructure in place (10+ tests)
- [ ] Notion integration working (live task data in UI)
- [ ] Charts rendering with live data
- [ ] DailyBrief grouping by due date
- [ ] Theme system verified (3 themes functional)
- [ ] Performance audit passed (no memory leaks)
- [ ] Error handling comprehensive (all scenarios covered)
- [ ] Responsive layout working (mobile to desktop)
- [ ] Blueprint parity achieved or documented

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| File lock issue on App.tsx | Blocks Phase 1 start | Restart dev environment, check file permissions |
| Notion backend delayed | Blocks Phase 2 | Codex priority, escalate if needed |
| Chart.js rendering failures | Blocks Phase 1.4 | Mock data, console debugging |
| Large refactor breaks existing features | Quality issue | Comprehensive test coverage before refactor |
| Theme system broken | UX regression | Test all themes early (Phase 1.3) |
| Performance degradation | User frustration | Audit early (Phase 1), optimize incrementally |
| API contract mismatch between frontend/backend | Integration blocker | Written spec → Codex review → Opus approval |

---

## Notes for Lawrence

1. **Division of labor is locked in** (Feb 12 formalized):
   - Opus (me): All strategic/architectural/design decisions, final sign-off
   - Sonnet (future): Grind work (CSS, tests, renames)
   - Codex: Backend infrastructure only, no UI authority
   - You: Human-in-the-loop on org/funding decisions, final approvals

2. **Codex handoff is live** (Feb 13):
   - Notion backend integration is critical path blocker
   - Cannot wire frontend to Notion until backend ready
   - Expected completion: Feb 15-16

3. **Dev workflow established**:
   - Spec first, then implement, then review
   - File locking issue may need investigation (Mac filesystem?)
   - Happy to pair-debug if frontend won't start

4. **Next steps** (this week):
   - Unblock file lock issue
   - Confirm Codex Notion spec is clear
   - Verify dev environment runs cleanly
   - Start Phase 1.1 (App.tsx refactor)

5. **Budget**:
   - Frontend takeover: ~30-40 hours (this sprint + next)
   - Notion integration: ~20 hours (Codex)
   - Polish/ship: ~15 hours (Sonnet + Opus)
   - Total: ~75 hours, ~2 weeks elapsed time

Let's ship this.

---

**Document Version**: 1.0
**Last Updated**: Feb 13, 2026
**Next Review**: Feb 17, 2026 (end of Phase 1)
