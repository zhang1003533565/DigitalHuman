#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-8080}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-123456}"
DB_NAME="${DB_NAME:-digitalhuman}"

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

if "${DOCKER_COMPOSE[@]}" ps --services --status running | grep -qx "mysql"; then
  echo "MySQL container is already running. Skip Docker startup."
else
  echo "MySQL is not running. Starting backend Docker services ..."
  "${DOCKER_COMPOSE[@]}" up -d
fi

echo "Ensuring MySQL database exists: ${DB_NAME}"
if ! "${DOCKER_COMPOSE[@]}" exec -T mysql mysql -uroot -p"${DB_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >/dev/null 2>&1; then
  echo "MySQL is not ready yet. Waiting briefly and retrying database initialization ..."
  sleep 5
  "${DOCKER_COMPOSE[@]}" exec -T mysql mysql -uroot -p"${DB_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

if [ -x "$SCRIPT_DIR/mvnw" ]; then
  MVN_CMD=("$SCRIPT_DIR/mvnw")
elif command -v mvn >/dev/null 2>&1; then
  MVN_CMD=("mvn")
else
  echo "Error: mvnw/mvn not found."
  echo "Please install Maven or keep backend-java/mvnw in this project."
  exit 1
fi

echo "Starting backend-java on http://127.0.0.1:${PORT}"
echo "Using Maven command: ${MVN_CMD[*]}"

exec "${MVN_CMD[@]}" spring-boot:run \
  -Dspring-boot.run.jvmArguments="-Dserver.port=${PORT} -DDB_HOST=${DB_HOST} -DDB_PORT=${DB_PORT} -DDB_NAME=${DB_NAME} -DDB_USERNAME=${DB_USERNAME} -DDB_PASSWORD=${DB_PASSWORD}"
