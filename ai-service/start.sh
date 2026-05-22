#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-18755}"

if [ -x "$SCRIPT_DIR/.venv/bin/python" ]; then
  PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
else
  echo "Error: python3/python not found."
  echo "Please install Python 3.11+ or create ai-service/.venv first."
  exit 1
fi

echo "Starting ai-service on http://${HOST}:${PORT}"
echo "Using Python: $PYTHON_BIN"

exec "$PYTHON_BIN" -m uvicorn app:app --host "$HOST" --port "$PORT"
