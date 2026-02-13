#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "[dev-one] clearing port $port ($pids)"
    # shellcheck disable=SC2086
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

start_ollama() {
  if ! command -v ollama >/dev/null 2>&1; then
    echo "[dev-one] ollama not found; skipping"
    return
  fi

  if pgrep -f "ollama serve" >/dev/null 2>&1; then
    echo "[dev-one] ollama already running"
    return
  fi

  ollama serve >/tmp/module09-ollama.log 2>&1 &
  echo "[dev-one] started ollama (log: /tmp/module09-ollama.log)"
}

start_backend() {
  "$ROOT_DIR/shell/dev-backend.sh" >/tmp/module09-backend.log 2>&1 &
  BACKEND_PID=$!
  echo "[dev-one] started backend (pid: $BACKEND_PID, log: /tmp/module09-backend.log)"
}

wait_for_backend() {
  local tries=0
  until curl -sf http://127.0.0.1:8000/health -H "X-API-Key: MAGE-local-v.1" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [[ $tries -ge 30 ]]; then
      echo "[dev-one] backend did not become healthy in time"
      return 1
    fi
    sleep 1
  done
  echo "[dev-one] backend healthy"
}

verify_backend_routes() {
  local failures=0
  for route in "/health" "/ops/summary" "/ops/next" "/status"; do
    if ! curl -sf "http://127.0.0.1:8000${route}" -H "X-API-Key: MAGE-local-v.1" >/dev/null 2>&1; then
      echo "[dev-one] backend route failed: ${route}"
      failures=$((failures + 1))
    fi
  done
  if [[ $failures -gt 0 ]]; then
    echo "[dev-one] backend failed startup checks; tailing backend log:"
    tail -n 60 /tmp/module09-backend.log || true
    return 1
  fi
  echo "[dev-one] backend routes verified"
}

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

# Ensure stale dev servers don't cause port collisions.
stop_port 8000
stop_port 5173
start_ollama
start_backend
wait_for_backend
verify_backend_routes

cd "$ROOT_DIR/frontend"
npm install
npm run tauri:dev
