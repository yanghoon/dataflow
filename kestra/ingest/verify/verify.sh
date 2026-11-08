#!/usr/bin/env bash
# ADR-0005 검증을 로컬 compose 에서 다시 돌린다. 실제 Gerrit·GHES·사내 S3 없이 목 서버와 SeaweedFS 로 한다.
#   cd kestra/ingest && ./verify/verify.sh            # 지금 띄운 스택에서
#   VERIFY_RESET=1 ./verify/verify.sh                 # 볼륨까지 지우고 처음부터(로컬 전용. 운영 compose 에서 쓰지 않는다)
# 결과: 항목마다 PASS/FAIL, 마지막에 합계. 실패가 있으면 종료 코드 1.
set -uo pipefail
cd "$(dirname "$0")/.."

API="python3 verify/kestra_api.py"
PASS=0; FAIL=0
ok()   { echo "PASS  $1"; PASS=$((PASS + 1)); }
bad()  { echo "FAIL  $1"; FAIL=$((FAIL + 1)); }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }
aws_() { docker compose run --rm -T --no-deps --entrypoint sh s3-init -c "aws --endpoint-url http://s3:8333 $*" 2>/dev/null; }
objs() { aws_ "s3 ls --recursive s3://dataflow-bronze/$1" | awk '{print $4}'; }
state(){ tail -1 <<<"$1" | awk '{print $2}'; }
eid()  { tail -1 <<<"$1" | awk '{print $1}'; }
mock() { env "$@" docker compose up -d --no-deps mock-gerrit mock-ghes >/dev/null 2>&1; sleep 3; }

# 0. 로컬 시험용 비밀값(없을 때만 만든다. 있으면 건드리지 않는다)
if [ ! -d secrets ]; then
  mkdir -p secrets && chmod 700 secrets
  printf gerrit-bot >secrets/GERRIT_USERNAME; printf gerrit-pass-1 >secrets/GERRIT_PASSWORD; printf ghes-pat-1 >secrets/GHES_PAT
  printf dataflow >secrets/S3_ACCESS_KEY_ID; printf dataflow-secret >secrets/S3_SECRET_KEY_ID
  for k in PG OPS_PG; do printf kestra >secrets/${k}_USERNAME; printf k3str4 >secrets/${k}_PASSWORD; done
  chmod 600 secrets/*
fi

# 1. 단위·목 서버 시험
check "pytest(단위 + 목 서버)" "uvx pytest -q tests >/dev/null 2>&1"

# 2. 스택 기동
[ "${VERIFY_RESET:-0}" = 1 ] && docker compose down -v >/dev/null 2>&1
docker compose up -d >/dev/null 2>&1; mock
for _ in $(seq 1 60); do curl -sf -u admin@example.com:Kestra1234 http://localhost:8080/api/v1/configs >/dev/null && break; sleep 3; done
sleep 5
n=$(curl -s -u admin@example.com:Kestra1234 "http://localhost:8080/api/v1/main/flows/search?size=50" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['results']))")
check "흐름 5개가 파일 감시로 등록(main_<ns>.<id>.yml)" "[ '$n' -ge 5 ]"
out=$($API run dataflow.ingest setup_kv); check "setup_kv" "[ $(state "$out") = SUCCESS ]"

# 3. Gerrit 세 스트림(검증 1·5, IR1·IR2·IG3)
out=$($API run dataflow.ingest gerrit); E=$(eid "$out")
check "gerrit 성공" "[ $(state "$out") = SUCCESS ]"
for s in account:250 project:250 group:200; do
  k=$(objs "bronze/gerrit/${s%%:*}/" | grep "$E"); c=$(aws_ "s3 cp s3://dataflow-bronze/$k -" | wc -l | tr -d ' ')
  check "gerrit ${s%%:*} ${c}건, 경로 B1·B2($k)" "[ '$c' = '${s##*:}' ] && [[ '$k' =~ dt=[0-9-]{10}/hr=[0-9]{2}/[0-9]{8}T[0-9]{6}Z_${E}\.jsonl$ ]]"
done

# 4. GHES 생성 대기(필수 2, IH2·IH4)
for mode in 202 empty; do
  mock MOCK_GHES_MODE=$mode
  out=$($API run dataflow.ingest ghes_active_users interval=PT5S max_wait=PT2M); E=$(eid "$out")
  k=$(objs bronze/ghes/ | grep "$E")
  same=$( [ "$(aws_ "s3 cp s3://dataflow-bronze/$k -" | md5sum | cut -c1-32)" = "$(python3 -c 'import hashlib,sys;sys.path.insert(0,"mock");import server;print(hashlib.md5(server.CSV.encode()).hexdigest())')" ] && echo y)
  check "ghes 생성 중($mode) 뒤 성공, CSV 바이트 동일" "[ $(state "$out") = SUCCESS ] && [ '$same' = y ]"
done
mock MOCK_GHES_PENDING=1000
out=$($API run dataflow.ingest ghes_active_users interval=PT5S max_wait=PT20S); E=$(eid "$out")
check "ghes 최대 대기 초과면 실패, 객체 없음(IH3·IH5)" "[ $(state "$out") = FAILED ] && [ -z \"\$(objs bronze/ghes/ | grep $E)\" ]"
mock

# 5. PG(IP1·IP2)
out=$($API run dataflow.ingest pg_users); E=$(eid "$out")
k=$(objs bronze/pg/ | grep "$E"); c=$(aws_ "s3 cp s3://dataflow-bronze/$k -" | wc -l | tr -d ' ')
check "pg 성공, 501줄(헤더 + 500)" "[ $(state "$out") = SUCCESS ] && [ '$c' = 501 ]"
docker compose exec -T postgres psql -U kestra -d source_users -qc "create table if not exists empty_users (like users)" >/dev/null
$API run dataflow.ingest setup_kv pg_table=public.empty_users >/dev/null
out=$($API run dataflow.ingest pg_users)
check "pg 0건이면 실패(IP2)" "[ $(state "$out") = FAILED ]"
$API run dataflow.ingest setup_kv >/dev/null

# 6. 비밀값 교체: 편집기처럼 새 inode 로 바꾸고 재기동 없이(필수 8, IR4)
orig=$(cat secrets/GHES_PAT); started=$(docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q kestra)")
printf ghes-pat-rotated >secrets/.GHES_PAT.new && chmod 600 secrets/.GHES_PAT.new && mv secrets/.GHES_PAT.new secrets/GHES_PAT
out=$($API run dataflow.ingest ghes_active_users interval=PT5S max_wait=PT2M)
check "비밀값 파일 교체 후 재기동 없이 새 값으로 인증" "[ $(state "$out") = SUCCESS ] && [ '$started' = \"\$(docker inspect -f '{{.State.StartedAt}}' \$(docker compose ps -q kestra))\" ]"
printf '%s' "$orig" >secrets/.GHES_PAT.new && chmod 600 secrets/.GHES_PAT.new && mv secrets/.GHES_PAT.new secrets/GHES_PAT

# 7. 백필: 예정 시각 폴더(필수 13, B1)
day=$(python3 -c "import datetime as d;print((d.datetime.now(d.timezone.utc)-d.timedelta(days=1)).strftime('%Y-%m-%d'))")
$API backfill dataflow.ingest gerrit hourly "${day}T10:00:00Z" "${day}T11:30:00Z"
# 백필 실행 둘이 끝날 때까지 기다린다(다음 단계가 S3를 멈추므로)
for _ in $(seq 1 100); do [ "$($API search dataflow.ingest gerrit | grep "${day}T1[01]:00" | grep -cE ' (SUCCESS|FAILED) ')" -ge 2 ] && break; sleep 3; done
bf=$($API search dataflow.ingest gerrit | grep "${day}T1[01]:00" | grep -c ' SUCCESS ')
check "백필 두 실행 성공, 결과가 dt=$day/hr=10·11 폴더에(스트림 3개씩)" "[ '$bf' = 2 ] && [ \"\$(objs bronze/gerrit/ | grep -cE \"dt=$day/hr=1[01]/\")\" = 6 ]"

# 8. restart: 업로드만 실패시킨 뒤 restart(검증 10, B3·IR8)
docker compose stop s3 >/dev/null 2>&1
out=$($API run dataflow.ingest gerrit); E=$(eid "$out")
docker compose start s3 >/dev/null 2>&1; sleep 8
out=$($API restart "$E")
check "restart 성공, 받기는 다시 안 돎(fetch attempts=1), 같은 파일명" "[ $(state "$out") = SUCCESS ] && grep -q 'fetch .* attempts=1' <<<\"$out\" && [ \"\$(objs bronze/gerrit/ | grep -c $E)\" = 3 ]"

# 9. 재시도와 0건(IR6·IG5)
mock MOCK_FAIL_FIRST=1
out=$($API run dataflow.ingest gerrit)
check "5xx 한 번 뒤 재시도로 성공(fetch attempts=2)" "[ $(state "$out") = SUCCESS ] && grep -q 'fetch .* attempts=2' <<<\"$out\""
mock MOCK_GERRIT_GROUPS=0
out=$($API run dataflow.ingest gerrit); E=$(eid "$out")
check "Group 0건이면 실패, 객체 없음(IG5·IR9)" "[ $(state "$out") = FAILED ] && [ -z \"\$(objs bronze/gerrit/ | grep $E)\" ]"
mock

# 10. 감시 표(필수 16)
sleep 5
rows=$(docker compose exec -T postgres psql -U kestra -d ingest_ops -Atc "select count(*) filter (where state='FAILED'), count(*) filter (where scheduled_at = timestamptz '${day} 10:00:00+00') from ingest_run_status")
check "감시 표에 실패 기록과 백필 예정 시각($rows)" "[ \"\${rows%%|*}\" -ge 1 ] && [ \"\${rows##*|}\" -ge 1 ]"

# 11. 로그에 비밀값 없음(IR4)
leaks=$(docker compose logs kestra 2>&1 | grep -cE "$(paste -sd'|' secrets/GHES_PAT secrets/GERRIT_PASSWORD secrets/S3_SECRET_KEY_ID)")
check "서버 로그에 비밀값 없음" "[ '$leaks' = 0 ]"

# 12. 실버 규칙(B4, 검증 7·14): 스트림이 빠진 가짜 실행을 하나 넣고 제외되는지
src=$(objs bronze/gerrit/account/ | tail -1)
aws_ "s3 cp s3://dataflow-bronze/$src s3://dataflow-bronze/${src%/*}/29991231T235959Z_PARTIALrunONLYaccount01.jsonl" >/dev/null
check "실버(DuckDB): 완전한 실행 중 최신 선택, filename 열, NULL·빈 문자열" "uvx --with duckdb python verify/silver_check.py >/tmp/silver_check.out 2>&1"
aws_ "s3 rm s3://dataflow-bronze/${src%/*}/29991231T235959Z_PARTIALrunONLYaccount01.jsonl" >/dev/null

echo "합계: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ]
