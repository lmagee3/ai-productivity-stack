#!/usr/bin/env bash
set -euo pipefail

API_KEY="${API_KEY:-MAGE-local-v.1}"

ok() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; }

if pgrep -f "ollama serve" >/dev/null 2>&1; then
  ok "Ollama runtime is running"
else
  warn "Ollama runtime is not running"
fi

if curl -sf http://127.0.0.1:8000/health -H "X-API-Key: ${API_KEY}" >/dev/null 2>&1; then
  ok "Backend health endpoint is reachable"
else
  warn "Backend health endpoint is not reachable"
fi

if lsof -ti tcp:5173 >/dev/null 2>&1 || lsof -ti tcp:5174 >/dev/null 2>&1 || lsof -ti tcp:5175 >/dev/null 2>&1; then
  ok "Frontend dev server port is active (5173/5174/5175)"
else
  warn "Frontend dev server port is not active (5173/5174/5175)"
fi

