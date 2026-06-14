#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-18755}"
VENV_DIR="${VENV_DIR:-.venv}"
RUN_MODE="${RUN_MODE:-local}"

if [ -x "$SCRIPT_DIR/${VENV_DIR}/bin/python" ]; then
  PYTHON_BIN="$SCRIPT_DIR/${VENV_DIR}/bin/python"
elif [ -x "$SCRIPT_DIR/venv/bin/python" ] && [ "$VENV_DIR" = ".venv" ]; then
  # Backward compatibility for older local environments.
  PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  BOOTSTRAP_PYTHON="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  BOOTSTRAP_PYTHON="$(command -v python)"
else
  echo "Error: python3/python not found."
  echo "Please install Python 3.11+ first."
  exit 1
fi

if [ -z "${PYTHON_BIN:-}" ]; then
  echo "Creating virtual environment at ${VENV_DIR} ..."
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
