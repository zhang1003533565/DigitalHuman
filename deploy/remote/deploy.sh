#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR"

ENV_FILE="${DIGITALHUMAN_ENV_FILE:-.env}"
COMPOSE_FILE="${DIGITALHUMAN_COMPOSE_FILE:-compose.prod.yml}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env and fill server secrets first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_vars=(
  ALIYUN_REGISTRY
  ALIYUN_NAMESPACE
  MYSQL_ROOT_PASSWORD
  DB_PASSWORD
  AI_SERVICE_ADMIN_TOKEN
  TTS_BASE_URL
)

for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

IMAGE_TAG="${DIGITALHUMAN_IMAGE_TAG:-latest}"

export DIGITALHUMAN_BACKEND_IMAGE="${DIGITALHUMAN_BACKEND_IMAGE:-${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${DIGITALHUMAN_BACKEND_REPOSITORY:-digitalhuman-backend}:${IMAGE_TAG}}"
export DIGITALHUMAN_AI_SERVICE_IMAGE="${DIGITALHUMAN_AI_SERVICE_IMAGE:-${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${DIGITALHUMAN_AI_SERVICE_REPOSITORY:-digitalhuman-ai-service}:${IMAGE_TAG}}"
export DIGITALHUMAN_FRONTEND_ADMIN_IMAGE="${DIGITALHUMAN_FRONTEND_ADMIN_IMAGE:-${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${DIGITALHUMAN_FRONTEND_ADMIN_REPOSITORY:-digitalhuman-frontend-admin}:${IMAGE_TAG}}"
export DIGITALHUMAN_FRONTEND_VISITOR_IMAGE="${DIGITALHUMAN_FRONTEND_VISITOR_IMAGE:-${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${DIGITALHUMAN_FRONTEND_VISITOR_REPOSITORY:-digitalhuman-frontend-visitor}:${IMAGE_TAG}}"

if [[ -n "${ALIYUN_USERNAME:-}" && -n "${ALIYUN_PASSWORD:-}" ]]; then
  echo "$ALIYUN_PASSWORD" | docker login "$ALIYUN_REGISTRY" --username "$ALIYUN_USERNAME" --password-stdin
else
  echo "ALIYUN_USERNAME or ALIYUN_PASSWORD is empty; pulling public images without docker login."
fi

# Keep this as the production equivalent of: docker compose pull.
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
# Keep this as the production equivalent of: docker compose up -d.
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

if [[ "${DIGITALHUMAN_SKIP_CLEANUP:-0}" != "1" ]]; then
  ./cleanup.sh
fi
