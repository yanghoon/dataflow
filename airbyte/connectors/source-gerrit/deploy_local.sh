#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="docker.io/airbyte/source-gerrit-custom:0.0.1"
NODE_CONTAINER="airbyte-abctl-control-plane"

docker build \
  --build-arg PIP_INDEX_URL="${PIP_INDEX_URL:-}" \
  --build-arg PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-}" \
  -t "${IMAGE_NAME}" .

docker save "${IMAGE_NAME}" | docker exec -i "${NODE_CONTAINER}" ctr --namespace k8s.io images import -
docker exec "${NODE_CONTAINER}" ctr --namespace k8s.io images list name=="${IMAGE_NAME}"
