#!/usr/bin/env bash
set -euo pipefail

ONLINE=0
if [[ "${1:-}" == "--online" ]]; then
  ONLINE=1
fi

echo "Checking Python..."
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python3 not found. Install Python 3.11+ and retry."
  exit 1
fi
python3 --version

if [[ ! -d "backend/.venv" ]]; then
  echo "Creating backend venv..."
  python3 -m venv backend/.venv
fi

if [[ "$ONLINE" -eq 1 ]]; then
  echo "Installing backend deps..."
  source backend/.venv/bin/activate
  pip install -r backend/requirements.txt
fi

echo "Checking Node..."
if ! command -v node >/dev/null 2>&1; then
  echo "Node not found. Install Node 18+ and retry."
  exit 1
fi
node --version

if [[ ! -d "frontend/node_modules" ]]; then
  echo "frontend/node_modules missing. Run: cd frontend && npm install"
fi
