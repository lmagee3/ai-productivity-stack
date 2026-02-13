# module_09 UI/UX Audit — Claude Cowork
**Date**: February 12, 2026
**Auditor**: Claude Cowork (UI/UX Authority per Lawrence directive)
**Scope**: React/TypeScript frontend vs. original HTML dashboard blueprints
**Verdict**: 14 regressions identified. 4 critical, 6 major, 4 minor.

---

## EXECUTIVE SUMMARY

Codex built solid backend infrastructure but the frontend lost significant UI/UX fidelity during the port from my original HTML dashboards. The React code is structurally sound — proper TypeScript types, clean component hierarchy, good state management. But the *visual execution* regressed in every measurable dimension: typography, color consistency, layout hierarchy, data visualization, and theme safety.

The fixes are surgical. No architectural changes needed — just CSS token corrections, Chart.js restoration, and a handful of JSX tweaks.

---

## REGRESSION INVENTORY

### CRITICAL (Blocks professional demo)

**C1. Charts are dead placeholders**
- **File**: `OverviewPanel.tsx` lines 158-179
- **What**: Three chart cards show "No chart data yet", "Awaiting more data", "Sync more tasks to unlock"
- **Original**: Real Chart.js — status doughnut (cutout 60%), domain doughnut, priority-by-domain horizontal stacked bar
- **Impact**: Mission Control loses its primary data visualization. Amico demo looks like a wireframe.
- **Fix**: Import Chart.js, wire up canvas elements with real data from `ops` prop. Port chart configs from mission-control.html.

**C2. Sprint view gutted**
- **File**: `App.tsx` sprint tab render (lines ~530-570)
- **What**: Just a progress bar + flat task list
- **Original**: Chart.js burndown line chart (ideal vs actual), velocity metrics, critical path visualization
- **Impact**: Sprint view was the operational heart of Mission Control. Now it's a TODO list.
- **Fix**: Restore burndown chart, add velocity/critical-path sections.

**C3. Four CSS classes referenced but never defined**
- **Files**: `OverviewPanel.tsx`, `DailyBrief.tsx`
- **Missing classes**:
  - `.view-panel` — wrapper for all view content (no padding/margin applied)
  - `.chat-column` — chat sub-sections (no layout applied)
  - `.brief-col` — brief grid columns (no column styling applied)
  - `.news-section` base rule — only `.news-section.active` implied, no base display rule
- **Impact**: Content renders unstyled/collapsed in these containers. Layout breaks silently.
- **Fix**: Add CSS rules for all four classes.

**C4. Hardcoded colors break light/CRT themes**
- **File**: `styles.css` — 40+ instances
- **Hardcoded hex values**: `#1a1a2e`, `#1e293b`, `#111827`, `#334155`, `#2d2d44`, `#16161f`, `#1f1f2e`, `#1a1207`
- **Impact**: Light theme gets dark backgrounds on badges, news items, task rows, sync buttons, filter buttons. CRT theme gets non-green elements. Themes are *broken* outside dark mode.
- **Fix**: Replace hardcoded values with CSS variable references or add theme-specific overrides.

---

### MAJOR (Degrades professional quality)

**M1. Typography hierarchy flattened**
- **Current**: `mc-val` is `20px/700` (styles.css) but rendered at `24px/800` in metric cards
- **Original**: `mc-val` was `28px/800` — large, confident metric numbers
- **Impact**: Metrics don't punch. The visual weight that made Mission Control feel like a command center is diluted.
- **Fix**: Restore `mc-val` to `font-size: 28px; font-weight: 800`.

**M2. Two duplicate badge systems**
- **OverviewPanel.tsx**: Uses `.domain-tag` + `.domain-kairos` (text color only, shared bg `#1a1a2e`)
- **DailyBrief.tsx**: Uses `.badge-source` + `.badge-domain-kairos` (different sizing, border `#2d2d44`)
- **Original**: Single badge system per dashboard, consistent sizing
- **Impact**: Visual inconsistency between views. Same domain shows different badge styles.
- **Fix**: Unify to one badge system. Use `.domain-tag` everywhere with consistent sizing.

**M3. Chat section too dominant**
- **File**: `styles.css` line ~650, `OverviewPanel.tsx` lines 275-364
- **Current**: `.chat-grid` is `2fr 1fr` with `min-height: 220px`
- **Impact**: Chat consumes 60%+ of below-fold space. Operational data (metrics, charts, attack order) gets pushed up and compressed while chat sprawls.
- **Fix**: Reduce to `1fr 1fr` or `3fr 2fr`. Drop `min-height` to `160px`. Chat is important but shouldn't dominate the ops dashboard.

**M4. Information hierarchy flat**
- **File**: `styles.css` — `.section-card` class
- **Current**: All section-cards (Attack Order, Scan Signals, Chat) have identical visual treatment
- **Original**: Different visual weight per section — Attack Order was prominent with colored rank badges, charts had distinct wrap backgrounds, suggestions had hover states
- **Impact**: Everything looks the same priority. User can't scan the page and know where to look.
- **Fix**: Add visual differentiation — Attack Order gets stronger header, charts get distinct background, chat gets subtle inset.

**M5. Spacing rhythm inconsistent**
- **File**: `styles.css` throughout
- **Current**: Mixes 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24px without pattern
- **Original**: Consistent 4px base unit (8, 12, 16, 20, 24) with rare exceptions
- **Impact**: Subtle but pervasive — layouts feel "off" without anyone knowing why.
- **Fix**: Normalize to 4px grid: 4, 8, 12, 16, 20, 24. Replace 6→8, 7→8, 9→8, 10→12, 14→16, 18→16.

**M6. Static news placeholders in DailyBrief**
- **File**: `DailyBrief.tsx` lines 29-46
- **What**: Hardcoded `NEWS` const with fake items ("Market Pulse", "Rates Watch", "Global Brief")
- **Also**: Real headlines integration exists (from backend) but static fallback is never cleared
- **Impact**: Mix of real and fake data in the brief
- **Fix**: Remove static NEWS const. Use headlines prop exclusively. Show "Loading headlines..." when empty.

---

### MINOR (Polish items)

**m1. `.days-label` referenced but unstyled**
- **File**: mission-control.html defines `.days-label`, `.days-overdue`, `.days-today`, `.days-soon`, `.days-normal`
- **Current CSS**: No `.days-label` rules in styles.css
- **Fix**: Port the 5 `.days-*` rules from original.

**m2. Icon sizing inconsistent**
- **Original**: Metric icons were `18px` in `36x36` boxes. Current: `16px` emoji in `32x32` boxes.
- **Fix**: Restore to `36x36` boxes, `18px` icon size.

**m3. Footer timestamp styling**
- **Current**: `color: #2d2d44` (hardcoded, nearly invisible on dark bg)
- **Original**: `color: var(--muted)` (properly themed)
- **Fix**: Replace with `color: var(--muted)`.

**m4. Scrollbar inconsistency**
- **Current**: `#111` track, `#333` thumb (hardcoded)
- **Original**: Same values but dashboard.html uses `var(--border)` for thumb
- **Fix**: Use CSS variables for scrollbar colors to respect themes.

---

## FIX PRIORITY ORDER

| # | Item | Files | Effort | Impact |
|---|------|-------|--------|--------|
| 1 | C3: Missing CSS classes | styles.css | 15 min | Layout breaks |
| 2 | C4: Hardcoded colors | styles.css | 30 min | Theme breaks |
| 3 | M1: Typography scale | styles.css | 5 min | Visual punch |
| 4 | M5: Spacing rhythm | styles.css | 20 min | Polish |
| 5 | M2: Unified badges | styles.css, DailyBrief.tsx | 15 min | Consistency |
| 6 | M3: Chat proportions | styles.css | 5 min | Layout balance |
| 7 | M4: Section hierarchy | styles.css | 10 min | Scannability |
| 8 | M6: Static news removal | DailyBrief.tsx | 10 min | Data integrity |
| 9 | C1: Chart.js restoration | OverviewPanel.tsx, package.json | 45 min | Data viz |
| 10 | C2: Sprint view restoration | App.tsx | 30 min | Sprint ops |
| 11 | m1-m4: Minor polish | styles.css | 15 min | Completeness |

**Total estimated effort**: ~3.5 hours for full parity restoration.

---

## WHAT CODEX DID RIGHT

Credit where due:
- Clean TypeScript interfaces and prop types
- Proper component decomposition (Overview, Brief, Settings, Scan as separate files)
- Theme system architecture (CSS variables with `data-theme` attribute) is correct
- localStorage persistence for preferences and task checks
- Responsive breakpoints at 1000px and 900px
- State management pattern (lift state to App, pass as props) is sound
- Attack Order ranking algorithm works correctly
- Scan progress bar animation is smooth
- Settings modal toggle pattern is clean

The *structure* is professional. The *visual execution* needs my hand.

---

## ORIGINAL DESIGN TOKENS (GOLD STANDARD)

For reference during fixes:

```css
/* Mission Control Dark Theme */
--bg: #0a0a0f;
--text: #e5e7eb;
--card: #111118;
--border: #1e1e2e;
--muted: #6b7280;
--accent: #7c3aed;
--accent-2: #a78bfa;
--accent-3: #60a5fa;

/* Metric values: 28px, weight 800 */
/* Section headers: 12px, weight 700, uppercase, letter-spacing 0.5px */
/* Card radius: 12px, padding: 16px */
/* Icon boxes: 36x36, 8px radius */
/* Spacing grid: 8, 12, 16, 20, 24 (4px base) */

/* Domain colors (consistent everywhere): */
/* Kairos: #a78bfa */
/* Job Search: #60a5fa */
/* School: #fbbf24 */
/* Personal: #22d3ee */
/* Email: #34d399 */
/* Web: #fb923c */
/* Files: #f472b6 */

/* Chart.js colors: */
/* Done: #22c55e, In Progress: #3b82f6, To Do: #6b7280, Blocked: #ef4444 */
/* Burndown ideal: #374151 dashed, actual: #a78bfa filled */
```
