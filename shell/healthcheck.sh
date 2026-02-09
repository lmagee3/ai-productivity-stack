#!/usr/bin/env bash
set -euo pipefail

API_URL="${1:-http://127.0.0.1:8000/health}"

curl -sS "$API_URL" | python -m json.tool
