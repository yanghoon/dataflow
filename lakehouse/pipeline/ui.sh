#!/usr/bin/env bash
# DuckDB UI를 띄운다. 모든 카탈로그를 읽은 상태라 UI에서 <tier>.<system_type>.<표>() 로 바로 조회한다.
#   pipeline/ui.sh   → 브라우저에서 http://localhost:4213 을 연다
# 작업 폴더는 lakehouse/ 다. pipeline/.env 가 있으면 읽고, INIT_FILES(기본 pipeline/_init/base.sql) → _catalog/*/*.sql 순서로 읽는다.
# 이 터미널의 DuckDB 프롬프트는 계속 입력을 받는다. 닫으면 UI도 끊긴다.
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -f pipeline/.env ]; then
  set -a
  . pipeline/.env
  set +a
fi

read -ra inits <<< "${INIT_FILES:-pipeline/_init/base.sql}"
args=()
for i in "${inits[@]}"; do
  args+=(-cmd ".read $i")
done
for c in pipeline/_catalog/*/*.sql; do
  args+=(-cmd ".read $c")
done
# 브라우저는 직접 연다(WSL 안에서는 브라우저를 열지 못한다)
args+=(-cmd "CALL start_ui_server();")

echo "DuckDB UI: http://localhost:4213"
exec duckdb "${args[@]}"
