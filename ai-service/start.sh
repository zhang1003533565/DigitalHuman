#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-18755}"
VENV_DIR="${VENV_DIR:-.venv}"
RUN_MODE="${RUN_MODE:-local}"
REQUIRED_PYTHON_VERSION="3.11"

python_version_ok() {
  "$1" - <<'PY'
import sys
raise SystemExit(0 if sys.version_info >= (3, 11) else 1)
PY
}

python_version_text() {
  "$1" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
PY
}

find_bootstrap_python() {
  for candidate in python3.13 python3.12 python3.11 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      local candidate_path
      candidate_path="$(command -v "$candidate")"
      if python_version_ok "$candidate_path"; then
        printf '%s\n' "$candidate_path"
        return 0
      fi
    fi
  done

  return 1
}

if [ -x "$SCRIPT_DIR/${VENV_DIR}/bin/python" ]; then
  PYTHON_BIN="$SCRIPT_DIR/${VENV_DIR}/bin/python"
elif [ -x "$SCRIPT_DIR/venv/bin/python" ] && [ "$VENV_DIR" = ".venv" ]; then
  # Backward compatibility for older local environments.
  PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
fi

if [ -n "${PYTHON_BIN:-}" ] && ! python_version_ok "$PYTHON_BIN"; then
  echo "Existing virtual environment uses Python $(python_version_text "$PYTHON_BIN"), but ai-service requires Python ${REQUIRED_PYTHON_VERSION}+."
  if [ "$VENV_DIR" = ".venv" ] || [ "$VENV_DIR" = "venv" ]; then
    echo "Recreating ${VENV_DIR} with a compatible Python ..."
    rm -rf "$SCRIPT_DIR/$VENV_DIR"
    PYTHON_BIN=""
  else
    echo "Error: refusing to remove custom VENV_DIR=${VENV_DIR}."
    echo "Please recreate it with Python ${REQUIRED_PYTHON_VERSION}+."
    exit 1
  fi
fi

if [ -z "${PYTHON_BIN:-}" ]; then
  if ! BOOTSTRAP_PYTHON="$(find_bootstrap_python)"; then
    echo "Error: Python ${REQUIRED_PYTHON_VERSION}+ not found."
    echo "Please install Python ${REQUIRED_PYTHON_VERSION}+ first, then rerun this script."
    exit 1
  fi

  echo "Creating virtual environment at ${VENV_DIR} ..."
  echo "Using bootstrap Python: ${BOOTSTRAP_PYTHON} ($(python_version_text "$BOOTSTRAP_PYTHON"))"
  "$BOOTSTRAP_PYTHON" -m venv "$VENV_DIR"
  PYTHON_BIN="$SCRIPT_DIR/${VENV_DIR}/bin/python"
fi

echo "Installing Python dependencies ..."
"$PYTHON_BIN" -m pip install --upgrade pip
"$PYTHON_BIN" -m pip install -r "$SCRIPT_DIR/requirements.txt"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker command not found."
  echo "Please install Docker Desktop first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker engine is not running."
  echo "Please start Docker Desktop and try again."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
else
  echo "Error: docker compose command not found."
  exit 1
fi

if [ "$RUN_MODE" = "docker" ]; then
  echo "Starting ai-service Docker service ..."
  "${DOCKER_COMPOSE[@]}" up -d
  echo "ai-service is running in Docker. Local uvicorn startup is skipped."
  echo "Visit: http://${HOST}:${PORT}/health"
  exit 0
fi

echo "Starting ai-service on http://${HOST}:${PORT}"
echo "Using Python: $PYTHON_BIN"

exec "$PYTHON_BIN" -m uvicorn app:app --host "$HOST" --port "$PORT"
