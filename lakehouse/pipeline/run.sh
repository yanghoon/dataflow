#!/usr/bin/env bash
# 받은 SQL 파일을 받은 순서대로 DuckDB CLI로 실행한다. 파일 목록은 셸 와일드카드로 준다.
#   pipeline/run.sh pipeline/jaffle_shop/*.sql                     정기 실행(_sample/ 은 골라지지 않는다)
#   pipeline/run.sh pipeline/jaffle_shop/2*.sql                    실버만
#   pipeline/run.sh pipeline/jaffle_shop/_sample/0*.sql pipeline/jaffle_shop/*.sql pipeline/jaffle_shop/_sample/9*.sql   로컬 시험
# 작업 폴더는 lakehouse/ 다. pipeline/.env 가 있으면 읽고, INIT_FILES(공백으로 나눔, 기본 pipeline/_init/base.sql)를 먼저 읽는다.
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "사용: $0 <SQL 파일>..." >&2
  exit 2
fi

# 와일드카드는 호출한 셸의 폴더에서 풀렸으므로, cd 하기 전에 절대 경로로 바꾼다
files=()
for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "파일 없음: $f" >&2
    exit 2
  fi
  files+=("$(cd "$(dirname "$f")" && pwd)/$(basename "$f")")
done

cd "$(dirname "$0")/.."
if [ -f pipeline/.env ]; then
  set -a
  . pipeline/.env
  set +a
fi

read -ra inits <<< "${INIT_FILES:-pipeline/_init/base.sql}"
init_args=()
for i in "${inits[@]}"; do
  init_args+=(-cmd ".read $i")
done

for f in "${files[@]}"; do
  printf '\n== %s\n' "${f#"$PWD"/}"   # 앞 단계 출력이 줄바꿈 없이 끝나도 머리줄이 새 줄에서 시작하게 한다
  duckdb -bail "${init_args[@]}" < "$f"
done
