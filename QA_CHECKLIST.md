# QA Checklist (module_09)

Use this checklist before merging or tagging a release.

## 1) Security & Repo Hygiene
- [ ] `backend/.env` is not tracked in git.
- [ ] `frontend/.env` is not tracked in git.
- [ ] `*.db` files are not tracked in git.
- [ ] Build artifacts are not tracked (`frontend/tsconfig.tsbuildinfo`).
- [ ] No credentials or tokens appear in commit diffs.

## 2) Backend Static Validation
- [ ] Python files compile (`python -m py_compile`) for `backend/app`.
- [ ] Alembic head is valid and migration chain is clean.
- [ ] New route stubs import without startup errors.

## 3) Core API Contract Smoke
- [ ] `GET /health` returns 200.
- [ ] `GET /status` returns 200.
- [ ] `GET /ops/summary` returns 200.
- [ ] `GET /ops/next` returns 200 (no naive/aware datetime errors).
- [ ] `POST /runtime/trigger` returns 200 for `news`.
- [ ] `POST /notion/sync` route reachable (success or configured error, not crash).
- [ ] `GET /market/quotes` returns valid JSON response shape.
- [ ] `GET /weather/current` returns valid JSON response shape.
- [ ] `GET /tools/web-search?q=...` returns structured results and provider name.

## 4) Runtime/Scheduler Observability
- [ ] `/status.runtime` exposes `runtime_started_at` and `runtime_heartbeat_at`.
- [ ] `/status.runtime` shows last run/error fields for scan/email/news/notion.
- [ ] Runtime trigger updates corresponding last-run timestamps.

## 5) Data Quality Guards
- [ ] No unrealistic due dates persisted from ingestion.
- [ ] Duplicate task generation is bounded by dedupe logic.
- [ ] `/ops/next` results are stable and sorted as expected.
- [ ] `tasks` with `due_date < 2025-01-01` are either absent or have `due_date = null`.

## 6) API Schema Validation
- [ ] `/status` contains required keys (`runtime`, `last_llm_latency_ms`, `last_llm_error`).
- [ ] `/market/quotes` contains (`provider`, `symbols`, `quotes`, `updated_at`).
- [ ] `/weather/current` contains (`provider`, `location`, `temperature`, `updated_at`).
- [ ] `/tools/web-search` contains (`provider`, `query`, `results`, `updated_at`).

## 7) Launch Flow
- [ ] `./run.sh` starts backend + desktop shell.
- [ ] `./shell/dev-one.sh` exits early with log tail on backend route failures.
- [ ] Tauri starts without package version mismatch errors.

## One-command QA
- Run:
  - `make qa`
