#!/usr/bin/env bash
# compose 네트워크 안에서 Playwright(Chromium)로 ui.mjs 를 실행한다.
# 스크린샷은 $OUT_DIR (기본: ./verify/out, git 무시) 에 남는다.
set -euo pipefail
cd "$(dirname "$0")"
OUT_DIR=${OUT_DIR:-$PWD/out}
mkdir -p "$OUT_DIR"
PW=1.65.0
docker run --rm --network kestra-oidc-poc_default \
  -v "$PWD/ui.mjs:/app/ui.mjs:ro" -v "$OUT_DIR:/out" \
  mcr.microsoft.com/playwright:v${PW}-noble \
  sh -c "cd /app && npm i --silent --no-save playwright@${PW} >/dev/null 2>&1 && node ui.mjs"
