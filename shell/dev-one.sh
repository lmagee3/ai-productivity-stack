#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

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

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

start_ollama
start_backend
wait_for_backend

cd "$ROOT_DIR/frontend"
npm install
npm run tauri:dev
