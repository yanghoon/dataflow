#!/usr/bin/env bash
# Kestra OSS + oauth2-proxy OIDC/감사 로그 E2E 검증 (호스트에서 curl 로 실행)
# 사전 조건: kestra/ 에서 `docker compose up -d` 후 kestra 가 healthy
set -uo pipefail
cd "$(dirname "$0")/.."

BASE=http://kestra.localtest.me:4180
API=$BASE/api/v1/main
WORK=$(mktemp -d)
JAR=$WORK/alice.jar
PASS=0; FAIL=0
ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
check(){ [ "$2" = "$3" ] && ok "$1 ($2)" || bad "$1 (expected $3, got $2)"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

oidc_login() { # $1=email $2=cookiejar
  local form
  form=$(curl -s -L -c "$2" -b "$2" -o /dev/null -w '%{url_effective}' "$BASE/oauth2/start?rd=/ui/")
  curl -s -L -c "$2" -b "$2" -o /dev/null -w '%{url_effective}' \
    --data-urlencode "login=$1" --data-urlencode "password=password" "$form"
}
csrf() { # $1=cookiejar — UI 와 같은 방식으로 index.html 의 meta csrf-token 을 읽는다
  curl -s -b "$1" -c "$1" "$BASE/ui/" | grep -o 'name="csrf-token" content="[^"]*"' | sed 's/.*content="//;s/"$//'
}

echo "[1] 세션 없이 접근하면 IdP 로 보내야 한다"
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/ui/")
case "$loc" in *dex.localtest.me*|*/oauth2/*) ok "302 → $loc" | cut -c1-110;; *) bad "redirect: $loc";; esac
check "세션 없는 API 호출 차단" "$(code -H 'Accept: application/json' "$API/flows/search")" 401

echo "[2] 클라이언트가 Kestra Basic 헤더를 직접 보내도 세션 없으면 차단"
check "Authorization 위조" "$(code -H 'Accept: application/json' -H 'Authorization: Basic YWRtaW5AZXhhbXBsZS5jb206S2VzdHJhMTIzNA==' "$API/flows/search")" 401

echo "[3] OIDC 로그인(alice) 후 Kestra 이중 로그인 없이 API 사용"
final=$(oidc_login alice@example.com "$JAR")
echo "        로그인 후 도착: $final"
grep -q _oauth2_proxy "$JAR" && ok "oauth2-proxy 세션 쿠키 발급" || bad "세션 쿠키 없음"
check "flows/search (Basic 헤더 주입)" "$(code -b "$JAR" "$API/flows/search")" 200
hdr=$(curl -s -D - -o /dev/null -b "$JAR" "$API/flows/search")
echo "$hdr" | grep -qi '^set-cookie: kestraBasicAuthenticated=true' && ok "응답에 UI 로그인 플래그 쿠키" || bad "플래그 쿠키 없음"
echo "$hdr" | grep -qi '^set-cookie: JWT=' && ok "응답에 CSRF 강제용 마커 쿠키" || bad "JWT 마커 쿠키 없음"
TOK=$(csrf "$JAR")
[ -n "$TOK" ] && ok "UI 의 CSRF 토큰 획득" || bad "CSRF 토큰 없음"

echo "[3b] 브라우저 세션 요청은 Kestra CSRF 검사를 받는다 (마커 쿠키 효과)"
check "CSRF 토큰 없는 POST 거부" "$(code -b "$JAR" -X POST "$API/executions/poc.audit/audit_probe")" 403
check "잘못된 CSRF 토큰 거부" "$(code -b "$JAR" -H 'X-CSRF-TOKEN: forged' -X POST "$API/executions/poc.audit/audit_probe")" 403

echo "[4] 쓰기 + 감사 로그 (X-Forwarded-Email 위조 시도 포함)"
FLOW=$(cat <<'YAML'
id: audit_probe
namespace: poc.audit
triggers:
  - id: hook
    type: io.kestra.plugin.core.trigger.Webhook
    key: poc-webhook-key
tasks:
  - id: hello
    type: io.kestra.plugin.core.log.Log
    message: hello
YAML
)
c=$(curl -s -o $WORK/flow.json -w '%{http_code}' -b "$JAR" -H "X-CSRF-TOKEN: $TOK" -X POST -H 'Content-Type: application/x-yaml' \
    -H 'X-Forwarded-Email: mallory@evil.test' --data-binary "$FLOW" "$API/flows")
[ "$c" = 200 ] || [ "$c" = 409 ] && ok "flow 생성 ($c)" || bad "flow 생성 ($c) $(head -c 200 $WORK/flow.json)"
check "실행 트리거" "$(code -b "$JAR" -H "X-CSRF-TOKEN: $TOK" -X POST "$API/executions/poc.audit/audit_probe")" 200
sleep 2
alog=$(docker compose logs kestra --since 2m 2>/dev/null | grep 'kestra.audit' | grep 'POST /api/v1/main/flows ')
echo "        $(echo "$alog" | tail -1 | sed 's/.*kestra.audit[^ ]* //' | cut -c1-150)"
echo "$alog" | grep -q '"alice@example.com"' && ok "Kestra access log 에 OIDC 사용자" || bad "access log 에 alice 없음"
echo "$alog" | grep -q 'mallory' && bad "위조한 이메일이 기록됨" || ok "위조 X-Forwarded-Email 은 무시됨"
plog=$(docker compose logs oauth2-proxy --since 2m 2>/dev/null | grep 'POST' | grep '"/api/v1/main/flows"' | tail -1)
echo "        $(echo "$plog" | cut -c1-160)"
echo "$plog" | grep -q 'alice@example.com' && ok "oauth2-proxy request log 에 사용자" || bad "proxy log 에 사용자 없음"

echo "[5] 사용자 구분: bob 으로 로그인하면 bob 으로 기록"
oidc_login bob@example.com "$WORK/bob.jar" >/dev/null
code -b "$WORK/bob.jar" -H "X-CSRF-TOKEN: $(csrf "$WORK/bob.jar")" -X POST "$API/executions/poc.audit/audit_probe" >/dev/null; sleep 2
docker compose logs kestra --since 1m | grep kestra.audit | grep 'POST /api/v1/main/executions/poc.audit' | grep -q '"bob@example.com"' \
  && ok "bob 실행이 bob 으로 기록" || bad "bob 기록 없음"

echo "[6] webhook 은 세션 없이 통과, 우회 경로로 악용 불가"
check "webhook (세션 없음)" "$(code -X POST "$API/executions/webhook/poc.audit/audit_probe/poc-webhook-key")" 200
check "잘못된 key" "$(code -X POST "$API/executions/webhook/poc.audit/audit_probe/wrong")" 404
# skip_auth 정규식에 걸리는 경로로 다른 API 에 도달하려는 시도 (path traversal)
t=$(code --path-as-is -X POST -H 'Content-Type: application/x-yaml' --data-binary "$FLOW" \
    "$API/executions/webhook/../../flows")
# 301 = 프록시가 경로를 정규화해 되돌려 보냄(upstream 미도달), 이후 요청은 인증 필요
case "$t" in 301|302|401|403|404|400|405) ok "traversal 로 flows API 도달 불가 ($t)";; *) bad "traversal 응답 $t";; esac
t=$(code --path-as-is -X POST "$API/executions/webhook/%2e%2e/%2e%2e/flows")
case "$t" in 302|401|403|404|400|405) ok "인코딩 traversal 도달 불가 ($t)";; *) bad "인코딩 traversal 응답 $t";; esac
docker compose logs kestra --since 2m | grep kestra.audit | grep -q 'webhook/\.\.\|%2e%2e' \
  && bad "traversal 요청이 Kestra 까지 도달" || ok "traversal 요청은 Kestra access log 에 없음(upstream 미도달)"

echo "[7] 프록시 우회(내부망 직접 접근)는 Kestra Basic Auth 가 막는다"
check "kestra:8080 직접, 자격증명 없음" "$(docker compose exec -T kestra curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-Email: alice@example.com' http://localhost:8080/api/v1/main/flows/search)" 401

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
rm -rf "$WORK"
[ "$FAIL" -eq 0 ]
