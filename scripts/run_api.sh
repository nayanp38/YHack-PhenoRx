#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# Export variables from .env so uvicorn and reload workers inherit GEMINI_API_KEY, etc.
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
export PYTHONPATH="$ROOT/src"
exec "$ROOT/.venv/bin/uvicorn" phenorx.api.main:app --reload --host 127.0.0.1 --port 8000
