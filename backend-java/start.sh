#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-8080}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-123456}"
WAIT_SECONDS="${WAIT_SECONDS:-180}"

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

echo "Starting mysql and redis with Docker ..."
"${DOCKER_COMPOSE[@]}" up -d mysql redis

if [ -x "$SCRIPT_DIR/mvnw" ]; then
  MVN_CMD=("$SCRIPT_DIR/mvnw")
elif command -v mvn >/dev/null 2>&1; then
  MVN_CMD=("mvn")
else
  echo "Error: mvnw/mvn not found."
  echo "Please install Maven or keep backend-java/mvnw in this project."
  exit 1
fi

echo "Waiting for MySQL to be healthy (timeout: ${WAIT_SECONDS}s) ..."
start_ts="$(date +%s)"
while true; do
  mysql_state="$("${DOCKER_COMPOSE[@]}" ps --format json mysql 2>/dev/null | sed -n 's/.*"Health":"\([^"]*\)".*/\1/p' | head -n 1 || true)"
  if [ "$mysql_state" = "healthy" ]; then
    break
  fi
  now_ts="$(date +%s)"
  elapsed="$((now_ts - start_ts))"
  if [ "$elapsed" -ge "$WAIT_SECONDS" ]; then
    echo "Error: MySQL did not become healthy within ${WAIT_SECONDS}s."
    "${DOCKER_COMPOSE[@]}" ps
    exit 1
  fi
  sleep 2
done

echo "Starting backend-java on http://127.0.0.1:${PORT}"
echo "Using Maven command: ${MVN_CMD[*]}"

exec "${MVN_CMD[@]}" spring-boot:run \
  -Dspring-boot.run.jvmArguments="-Dserver.port=${PORT} -DDB_HOST=${DB_HOST} -DDB_PORT=${DB_PORT} -DDB_USERNAME=${DB_USERNAME} -DDB_PASSWORD=${DB_PASSWORD}"
