#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR"

ENV_FILE="${DIGITALHUMAN_ENV_FILE:-.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

IMAGE_TAG="${DIGITALHUMAN_IMAGE_TAG:-latest}"
DIGITALHUMAN_IMAGE_KEEP="${DIGITALHUMAN_IMAGE_KEEP:-3}"
DIGITALHUMAN_PRUNE_UNTIL="${DIGITALHUMAN_PRUNE_UNTIL:-168h}"
DIGITALHUMAN_BUILDER_PRUNE_UNTIL="${DIGITALHUMAN_BUILDER_PRUNE_UNTIL:-24h}"

repositories=()
if [[ -n "${ALIYUN_REGISTRY:-}" && -n "${ALIYUN_NAMESPACE:-}" ]]; then
  repositories+=("${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${DIGITALHUMAN_BACKEND_REPOSITORY:-digitalhuman-backend}")
  repositories+=("${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${DIGITALHUMAN_AI_SERVICE_REPOSITORY:-digitalhuman-ai-service}")
  repositories+=("${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${DIGITALHUMAN_FRONTEND_ADMIN_REPOSITORY:-digitalhuman-frontend-admin}")
  repositories+=("${ALIYUN_REGISTRY}/${ALIYUN_NAMESPACE}/${DIGITALHUMAN_FRONTEND_VISITOR_REPOSITORY:-digitalhuman-frontend-visitor}")
fi

for repository in "${repositories[@]}"; do
  docker images "$repository" --format '{{.Repository}} {{.Tag}} {{.ID}}' \
    | awk -v keep="$DIGITALHUMAN_IMAGE_KEEP" -v current="$IMAGE_TAG" '
        $2 != "latest" && $2 != current {
          seen += 1
          if (seen > keep) {
            print $3
          }
        }
      ' \
    | xargs -r docker rmi || true
done

docker image prune -af --filter "until=${DIGITALHUMAN_PRUNE_UNTIL}" || true
docker builder prune -af --filter "until=${DIGITALHUMAN_BUILDER_PRUNE_UNTIL}" || true
