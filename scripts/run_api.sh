#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT/src"
exec "$ROOT/.venv/bin/uvicorn" phenorx.api.main:app --reload --host 127.0.0.1 --port 8000
