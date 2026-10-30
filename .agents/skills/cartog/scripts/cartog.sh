#!/bin/sh
# cartog.sh - Wrapper for cartog using docker-compose and docker exec
# 컨테이너를 상시 띄워두고 exec-i 로 매우 빠르게 명령을 수행합니다.

DOCKERFILE_DIR="$(cd "$(dirname "$0")" && pwd)"
export WORKSPACE_DIR="$(pwd)"
export HOST_CACHE_DIR="$HOME/.cache/cartog"

# 캐시 디렉토리 생성
mkdir -p "$HOST_CACHE_DIR"

cd "$DOCKERFILE_DIR"

# 백그라운드 인프라가 떠 있는지 확인
if ! docker compose ps 2>/dev/null | grep -q 'cartog-main'; then
    docker compose up -d >/dev/null 2>&1
fi

# 인자가 없으면 인터랙티브 쉘로 진입, 인자가 있으면 cartog 명령어로 전달
if [ $# -eq 0 ]; then
    exec docker exec -it cartog-main bash
else
    # -i 플래그는 stdio 통신을 위해 필수
    exec docker exec -i cartog-main cartog "$@"
fi
