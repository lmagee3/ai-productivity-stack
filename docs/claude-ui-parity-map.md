# Claude UI Parity Map (Mission Control + Daily Brief)

## Source Blueprints
- `/Users/lawrencemagee/Desktop/Kairos/mission-control.html`
- `/Users/lawrencemagee/Desktop/Kairos/daily-brief.html`
- `/Users/lawrencemagee/Desktop/Kairos/sprint-dashboard.jsx`

## Current Mapping
- Header structure + gradient title: `frontend/src/App.tsx`, `frontend/src/styles.css`
- Refresh control (`sync-btn`): `frontend/src/App.tsx`, `frontend/src/styles.css`
- Alert/nav/metric/card visual language: `frontend/src/styles.css`
- Overview core layout and sections: `frontend/src/features/overview/OverviewPanel.tsx`
- Daily brief layout and sections: `frontend/src/features/brief/DailyBrief.tsx`

## Remaining Parity Work
- Domain filter pill row parity in Overview task list.
- "Show all / show less" behavior parity for Attack Order.
- Sprint and Timeline view visual parity (currently placeholder views).
- Footer parity and timestamp presentation.
- Fine typography spacing pass (line-height and card density) to match Kairos templates exactly.

## Guardrails
- Do not break existing data wiring (`scan`, `ingest/email`, `ingest/web`, `news/headlines`).
- Keep approval-first behavior and route badges.
- No new frameworks/dependencies.
