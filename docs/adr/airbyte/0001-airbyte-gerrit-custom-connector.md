# ADR-0001: Airbyte Custom Connector Architecture for Gerrit

Gerrit REST API의 XSSI 보안 매직 스트링(`)]}'\n`)과 오프셋 페이지네이션을 처리하기 위해 Airbyte Low-code Builder 대신 Python CDK 기반 Pro-code 커넥터를 구축하고, 사내 프록시 환경의 Kind 클러스터(`airbyte-abctl`)에 `ctr images import` 방식으로 직접 주입하기로 결정했다.

## Status
Accepted

## Context & Problem Statement
- **Gerrit XSSI 매직 스트링**: Gerrit REST API는 보안을 위해 모든 응답 앞에 `)]}'\n`을 강제 삽입하여 Airbyte 기본 Low-code 파서에서 `JSONDecodeError`를 유발함.
- **오프셋 페이지네이션**: `/a/accounts/?q=...` 엔드포인트는 기본 25~500건 단위로 응답하며 마지막 원소의 `_more_accounts` 및 `S` 파라미터 기반 페이징 제어가 필수적임.
- **모노레포 및 프록시 환경**: 로컬 Kind 클러스터(`airbyte-abctl`) 및 사내망 프록시 환경에서 구동되어야 하며, 모노레포 루트 오염을 방지해야 함.

## Considered Options
1. **Low-code Connector Builder**: 브라우저 기반 GUI이나 매직 스트링 사전 처리 불가 및 UI 컨테이너 내 커스텀 컴포넌트(`ModuleNotFoundError`) 실행 한계로 기각.
2. **Reverse Proxy (Nginx/Sidecar)**: 매직 스트링을 제거하는 별도 프록시 컨테이너를 유지하는 안이나 추가 인프라 운영 비용으로 기각.
3. **Airbyte Python CDK (채택)**: 응답 인터셉트(`load_gerrit_json`), 동적 스키마 선언, 오프셋 페이지네이션 제어가 가능하며 경량 이미지 배포 가능.

## Decisions

### 1. 디렉토리 구조 및 확장 포인트 분리
모노레포 루트 오염을 방지하고 향후 GitOps 및 배포 확장을 위해 `airbyte/` 하위로 격리한다.
- `airbyte/connectors/source-gerrit/`: 커스텀 Gerrit Python CDK 커넥터 소스 및 Dockerfile.
- `airbyte/octavia/` (예정): Source, Destination, Connection 동기화 설정의 GitOps(YAML) 관리 경로.
- `airbyte/deploy/` (예정): abctl, Kind 클러스터, S3 연동 관련 인프라 매니페스트 경로.

### 2. 1차 릴리즈 범위 및 스트림 분리
- **1차 릴리즈**: `Users` 단일 스트림만 활성화 및 검증 완료 후 배포.
- **후속 분리**: `Projects` 및 `Groups` 스트림은 권한 모델 및 딕셔너리-레코드 정규화 요건이 다르므로 별도 ADR로 분리하여 추가.

### 3. 페이지네이션 및 사용자 설정
- `spec.json`에 `page_size` 프로퍼티를 정수형(Integer)으로 추가.
- 기본값은 `100`으로 설정하며, 대량 수집 시 사용자가 Gerrit 인스턴스 상한(통상 `500`)까지 동적으로 설정 가능하도록 지원.

### 4. 사내 프록시 및 로컬 배포 파이프라인
- Dockerfile 베이스 이미지는 `python:3.11-slim`을 채택.
- 사내망 의존성 해결을 위해 `PIP_INDEX_URL`, `PIP_TRUSTED_HOST` 빌드 인자를 지원하고, 패키지 충돌 방지를 위해 `--ignore-installed` 옵션 적용.
- `kind load` 대신 `docker save | docker exec -i airbyte-abctl-control-plane ctr --namespace k8s.io images import -` 파이프라인을 표준 배포 방식으로 채택.

### 5. Airbyte 프로토콜 준수 및 장애 방어
- **스키마 안정성**: 목적지(S3)의 Parquet/Avro 직렬화기 크래시를 방지하기 위해 `get_json_schema()`에 `"properties": {}` 선언을 의무화.
- **런타임 타입 가드**: `next_page_token`에서 Gerrit 에러 딕셔너리 응답 시 `data[-1]`로 인한 `KeyError: -1` 크래시를 막기 위해 `isinstance(data, list)` 검증 적용.
- **종단 상태 보장**: 소스 컨테이너의 비정상 종료로 인한 Destination의 `TransientErrorException` 방지를 위해 모든 HTTP 통신 및 파싱 예외를 철저히 격리 로깅.

## Consequences
- **동기화 모드 고정**: Gerrit 계정 API 특성상 `updated_at` 증분 조회가 불가능하므로 Full Refresh 모드로 한정한다.
- **배포 파이프라인 종속**: 로컬 노드 수동 주입 스크립트(`deploy_local.sh`)를 커넥터 디렉토리 내에 표준으로 동봉 관리한다.
- **구현 착수 기준**: 본 ADR 승인 완료 후 `airbyte/connectors/source-gerrit/`에 한해 파일 생성을 개시한다.

---

## Appendix A: Source Core Implementation (`source.py`)

```python
import json
import logging
import time
from typing import Any, Iterable, Mapping, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import requests
from airbyte_cdk.sources import AbstractSource
from airbyte_cdk.sources.streams.http import HttpStream
from airbyte_cdk.sources.streams.http.requests_native_auth import BasicHttpAuthenticator

logger = logging.getLogger("airbyte")

# HTTP 로깅 인터셉터 (비밀번호 제외한 통신 모니터링)
_orig_send = requests.Session.send

def _logged_send(self, request, **kwargs):
    start = time.time()
    try:
        resp = _orig_send(self, request, **kwargs)
    except Exception as e:
        logger.error(f"[HTTP] {request.method} {request.url} FAILED {type(e).__name__}: {e}")
        raise
    elapsed = time.time() - start
    size = resp.headers.get("Content-Length", "?")
    logger.info(f"[HTTP] {request.method} {request.url} -> {resp.status_code} ({elapsed:.2f}s, {size} bytes)")
    if resp.status_code >= 400:
        logger.error(f"[HTTP] error body: {resp.text[:500]!r}")
    return resp

requests.Session.send = _logged_send


def load_gerrit_json(response: requests.Response):
    text = response.text
    if text.startswith(")]}'"):          # XSSI 매직 스트링 제거
        text = text.split("\n", 1)[1] if "\n" in text else ""
    try:
        return json.loads(text) if text.strip() else []
    except json.JSONDecodeError:
        logger.error(f"[PARSE] JSON Decode Error url={response.request.url} status={response.status_code}")
        return []


class GerritStream(HttpStream):
    def __init__(self, config: Mapping[str, Any], **kwargs):
        super().__init__(authenticator=BasicHttpAuthenticator(
            username=config["username"], password=config["password"]))
        self._url_base = config["gerrit_url"].rstrip("/") + "/"

    @property
    def url_base(self) -> str:
        return self._url_base

    def get_json_schema(self) -> Mapping[str, Any]:
        # properties가 없으면 Destination 직렬화기(Parquet/Avro)에서 크래시 발생
        return {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {},
            "additionalProperties": True,
        }

    def next_page_token(self, response: requests.Response) -> Optional[Mapping[str, Any]]:
        return None


class Users(GerritStream):
    primary_key = "_account_id"

    def __init__(self, config: Mapping[str, Any], **kwargs):
        super().__init__(config, **kwargs)
        self.page_size = int(config.get("page_size", 100))

    def path(self, **kwargs) -> str:
        return "a/accounts/"

    def request_params(self, stream_state=None, stream_slice=None, next_page_token=None):
        params = {"q": "is:active OR is:inactive", "o": "DETAILS", "n": self.page_size}
        if next_page_token:
            params.update(next_page_token)
        return params

    def next_page_token(self, response):
        data = load_gerrit_json(response)
        # 에러 응답 시 dict가 와서 KeyError: -1 터지는 것 방어
        if isinstance(data, list) and data and data[-1].get("_more_accounts"):
            qs = parse_qs(urlparse(response.request.url).query)
            start = int(qs.get("S", ["0"])[0])
            logger.info(f"[PAGE] users next S={start + len(data)}")
            return {"S": start + len(data)}
        return None

    def parse_response(self, response, **kwargs):
        records = load_gerrit_json(response)
        if isinstance(records, list):
            logger.info(f"[PARSE] users: count={len(records)}")
            for rec in records:
                rec.pop("_more_accounts", None)
                yield rec


class SourceGerrit(AbstractSource):
    def check_connection(self, logger, config) -> Tuple[bool, Any]:
        try:
            url = config["gerrit_url"].rstrip("/") + "/a/accounts/self"
            res = requests.get(url, auth=(config["username"], config["password"]), timeout=30)
            res.raise_for_status()
            return True, None
        except Exception as e:
            return False, str(e)

    def streams(self, config: Mapping[str, Any]):
        # 1차 릴리즈 범위: Users 스트림 단독
        return [Users(config)]
```

## Appendix B: Connector Specification (`spec.json`)

```json
{
  "documentationUrl": "https://docs.airbyte.com",
  "connectionSpecification": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Gerrit Source Spec",
    "type": "object",
    "required": ["gerrit_url", "username", "password"],
    "properties": {
      "gerrit_url": {
        "type": "string",
        "order": 0,
        "title": "Base URL",
        "description": "Gerrit Server Base URL (e.g. https://gerrit.example.com)"
      },
      "username": {
        "type": "string",
        "order": 1,
        "title": "Username"
      },
      "password": {
        "type": "string",
        "order": 2,
        "title": "HTTP Password",
        "airbyte_secret": true
      },
      "page_size": {
        "type": "integer",
        "order": 3,
        "title": "Page Size",
        "description": "Accounts per page for pagination (default: 100, max: 500)",
        "default": 100
      }
    }
  }
}
```

## Appendix C: Deployment & Container Pipeline

```dockerfile
# Dockerfile
FROM python:3.11-slim

ARG PIP_INDEX_URL
ARG PIP_TRUSTED_HOST
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}

WORKDIR /airbyte/integration_code
COPY setup.py main.py ./
COPY source_gerrit ./source_gerrit

RUN pip install --no-cache-dir --ignore-installed .

ENV AIRBYTE_ENTRYPOINT="python /airbyte/integration_code/main.py"
ENTRYPOINT ["python", "/airbyte/integration_code/main.py"]
```

```bash
# deploy_local.sh
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
```
