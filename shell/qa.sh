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
