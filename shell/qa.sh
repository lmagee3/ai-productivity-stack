#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
API_KEY="${API_KEY:-MAGE-local-v.1}"

ok() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

check_not_tracked() {
  local pattern="$1"
  if git -C "$ROOT_DIR" ls-files | rg -q "^${pattern}$"; then
    fail "Tracked file disallowed: ${pattern}"
  else
    ok "Not tracked: ${pattern}"
  fi
}

echo "[qa] repo hygiene checks"
check_not_tracked "backend/.env"
check_not_tracked "frontend/.env"
check_not_tracked "frontend/tsconfig.tsbuildinfo"
if git -C "$ROOT_DIR" ls-files | rg -q "\\.db$"; then
  fail "Tracked .db file(s) found"
else
  ok "No tracked .db files"
fi

echo "[qa] backend compile checks"
cd "$BACKEND_DIR"
if [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
python -m py_compile app/main.py app/api/routes/*.py app/core/*.py app/services/*.py
ok "Python compile passed"

echo "[qa] optional live API checks"
if curl -sf http://127.0.0.1:8000/health -H "X-API-Key: ${API_KEY}" >/dev/null 2>&1; then
  ok "Backend reachable for live checks"
  for route in "/health" "/status" "/ops/summary" "/ops/next"; do
    curl -sf "http://127.0.0.1:8000${route}" -H "X-API-Key: ${API_KEY}" >/dev/null
    ok "Route OK: ${route}"
  done
  curl -sf -X POST http://127.0.0.1:8000/runtime/trigger \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d '{"job":"news"}' >/dev/null
  ok "Route OK: POST /runtime/trigger (news)"

  status_json="$(curl -sf http://127.0.0.1:8000/status -H "X-API-Key: ${API_KEY}")"
  STATUS_JSON="$status_json" python - <<'PY'
import json, os, sys
data = json.loads(os.environ["STATUS_JSON"])
required = ["runtime", "last_llm_latency_ms", "last_llm_error"]
missing = [k for k in required if k not in data]
if missing:
    print(f"missing keys: {missing}")
    sys.exit(1)
PY
  ok "Schema OK: /status"

  market_json="$(curl -sf "http://127.0.0.1:8000/market/quotes?symbols=SPY,AAPL" -H "X-API-Key: ${API_KEY}")"
  MARKET_JSON="$market_json" python - <<'PY'
import json, os, sys
data = json.loads(os.environ["MARKET_JSON"])
required = ["provider", "symbols", "quotes", "updated_at"]
missing = [k for k in required if k not in data]
if missing:
    print(f"missing keys: {missing}")
    sys.exit(1)
PY
  ok "Schema OK: /market/quotes"

  weather_json="$(curl -sf "http://127.0.0.1:8000/weather/current" -H "X-API-Key: ${API_KEY}")"
  WEATHER_JSON="$weather_json" python - <<'PY'
import json, os, sys
data = json.loads(os.environ["WEATHER_JSON"])
required = ["provider", "location", "temperature", "updated_at"]
missing = [k for k in required if k not in data]
if missing:
    print(f"missing keys: {missing}")
    sys.exit(1)
PY
  ok "Schema OK: /weather/current"

  search_json="$(curl -sf "http://127.0.0.1:8000/tools/web-search?q=module_09&limit=3" -H "X-API-Key: ${API_KEY}")"
  SEARCH_JSON="$search_json" python - <<'PY'
import json, os, sys
data = json.loads(os.environ["SEARCH_JSON"])
required = ["provider", "query", "results", "updated_at"]
missing = [k for k in required if k not in data]
if missing:
    print(f"missing keys: {missing}")
    sys.exit(1)
PY
  ok "Schema OK: /tools/web-search"

  old_due_count="$(python - <<'PY'
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.task import Task
cutoff = datetime(2025, 1, 1, tzinfo=timezone.utc)
with SessionLocal() as s:
    n = 0
    for t in s.query(Task).filter(Task.due_date.isnot(None)).all():
        dt = t.due_date if t.due_date.tzinfo else t.due_date.replace(tzinfo=timezone.utc)
        if dt < cutoff:
            n += 1
print(n)
PY
)"
  if [[ "${old_due_count}" == "0" ]]; then
    ok "Data quality OK: no due_date older than 2025-01-01"
  else
    fail "Data quality failed: ${old_due_count} tasks still have due_date before 2025-01-01"
  fi
else
  warn "Backend not running; skipped live API checks"
fi

echo "[qa] frontend build check (if dependencies present)"
cd "$FRONTEND_DIR"
if [[ -d node_modules ]]; then
  npm run build >/dev/null
  ok "Frontend build passed"
else
  warn "node_modules missing; skipped frontend build"
fi

ok "QA completed"
