#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(dirname "$0")/.."

# Start Ollama if available
if command -v ollama >/dev/null 2>&1; then
  if ! pgrep -f "ollama serve" >/dev/null 2>&1; then
    ollama serve >/dev/null 2>&1 &
    echo "[dev-all] Started ollama serve"
  else
    echo "[dev-all] ollama already running"
  fi
else
  echo "[dev-all] ollama not found; skipping"
fi

"$ROOT_DIR/shell/dev-backend.sh" &
BACKEND_PID=$!

"$ROOT_DIR/shell/dev-frontend.sh" &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT

wait
