# Gerrit Airbyte Source 커넥터

Gerrit Code Review(v3.8+)의 계정(**Gerrit Account**) 데이터를 Airbyte로 수집하기 위한 커스텀 소스 커넥터입니다.  
Gerrit 특유의 보안 접두어(XSSI 매직 스트링 `)]}'\n`)과 오프셋 페이지네이션을 안전하게 처리합니다.

---

## 1. 개요

* **대상 시스템**: Gerrit v3.8+ REST API (`/a/accounts/`)
* **수집 스트림**: `Accounts` (기본 키: `_account_id`)
* **핵심 기능**:
  - XSSI 매직 스트링 자동 제거 및 파싱 에러 방어
  - `_more_accounts` 플래그 및 `S` 오프셋 기반 자동 페이징
  - 대상 스토리지(S3 등) Parquet/Avro 직렬화 크래시 방지 스키마 적용
  - 민감 정보(Authorization) 마스킹 처리된 상세 HTTP 요청/응답 및 레코드 건수 디버깅 로그 제공

---

## 2. 빠른 시작: Airbyte Local 배포 (Getting Started)

로컬 Kind 클러스터(`airbyte-abctl`) 환경에 커넥터 이미지를 바로 빌드하고 주입하는 가장 빠른 방법입니다.

```bash
cd airbyte/connectors/source-gerrit

# 1. 도커 이미지 빌드 및 로컬 k8s 노드로 직접 주입
./deploy_local.sh
```

### Airbyte UI 등록 방법
1. 브라우저에서 Airbyte 콘솔(기본: `http://localhost:8000`)에 접속합니다.
2. **Settings** → **Sources** → **New custom connector** 클릭
3. 아래 정보를 입력하고 저장합니다:
   - **Connector name**: `Gerrit Custom Source`
   - **Docker image name**: `docker.io/airbyte/source-gerrit-custom:0.0.1`
   - **Documentation URL**: `https://docs.airbyte.com`

### 동작 모니터링 및 디버깅 로그
커넥터 동작 시 컨테이너 표준 출력(stdout)으로 통신 과정과 결과 행수가 상세히 기록됩니다:
* `[HTTP REQUEST] GET https://.../a/accounts/?... | Headers: {'Authorization': '***MASKED***', ...}`: 요청 엔드포인트 및 마스킹된 헤더
* `[HTTP RESPONSE] GET ... -> 200 (0.125s, size=1420 bytes, type=application/json)`: 응답 코드, 소요 시간, 데이터 크기
* `[PAGE] _more_accounts=True detected: batch_count=100, advancing offset from S=0 to S=100`: 페이징 진행 상태
* `[PARSE] Extracted and yielded 100/100 clean account records`: 정제 및 방출된 최종 행수

---

## 3. 개발 및 로컬 실행 방법

코드 수정 후 로컬에서 직접 커넥터 동작을 확인하는 방법입니다.

### 개발 환경 세팅
Python 3.11 가상환경을 생성하고 의존성을 설치합니다.
```bash
cd airbyte/connectors/source-gerrit

# uv 사용 시 (권장)
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e . pytest

# 기본 venv 사용 시
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e . pytest
```

### CLI로 커넥터 단독 실행 확인
```bash
# 1. Spec(설정 스키마) 출력 확인
python main.py spec

# 2. 연결 테스트
python main.py check --config sample_config.json

# 3. 데이터 동기화 읽기 테스트
python main.py read --config sample_config.json --catalog sample_catalog.json
```

---

## Appendix A: 테스트 방법 (Testing Guide)

외부 서버가 필요 없는 **더미 테스트**와 실제 Gerrit 서버를 검증하는 **실서버 테스트**로 나뉘어 있습니다.

### ① 더미 테스트 (단위/계약 검증 - 기본 추천)
실제 Gerrit 서버 접속 없이 1초 내에 파싱, 스키마, 페이징 계산, 로깅 인터셉터를 검증합니다.
```bash
pytest tests/unit -v
```

### ② 실서버 통합 테스트 (선택)
실제 구동 중인 Gerrit v3.8 인스턴스와 계정이 있을 때만 실행합니다. (환경변수가 없으면 자동으로 `skip` 처리됩니다)
```bash
export GERRIT_TEST_URL="https://gerrit.example.com"
export GERRIT_TEST_USERNAME="your_username"
export GERRIT_TEST_PASSWORD="your_http_password"

pytest tests/integration -m integration -v
```

### ③ 전체 테스트 한 번에 실행
```bash
pytest
```

---

## Appendix B: Docker 기반 커넥터 CLI 프로토콜 테스트

Airbyte UI 없이도 Docker 볼륨 마운트(`-v`)를 통해 커넥터의 전체 수명주기 기능을 직접 검증할 수 있습니다.

### 1. 테스트용 설정 파일 준비
```bash
mkdir -p /tmp/airbyte_test

# config.json 생성
cat << 'EOF' > /tmp/airbyte_test/config.json
{
  "gerrit_url": "https://gerrit.example.com",
  "username": "tester",
  "password": "secret_password",
  "page_size": 100
}
EOF

# catalog.json 생성
cat << 'EOF' > /tmp/airbyte_test/catalog.json
{
  "streams": [
    {
      "stream": {
        "name": "accounts",
        "json_schema": {},
        "supported_sync_modes": ["full_refresh"]
      },
      "sync_mode": "full_refresh",
      "destination_sync_mode": "overwrite"
    }
  ]
}
EOF
```

### 2. 프로토콜별 Docker 실행 명령어
```bash
# Spec 확인
docker run --rm test-source-gerrit:latest spec

# Discover (수집 스트림 및 스키마 카탈로그 확인 - 네트워크 불필요)
docker run --rm -v /tmp/airbyte_test:/secrets test-source-gerrit:latest discover --config /secrets/config.json

# Check (Gerrit 연결 및 인증 상태 확인)
docker run --rm -v /tmp/airbyte_test:/secrets test-source-gerrit:latest check --config /secrets/config.json

# Read (카탈로그 기반 데이터 동기화 읽기)
docker run --rm -v /tmp/airbyte_test:/secrets test-source-gerrit:latest read \
  --config /secrets/config.json \
  --catalog /secrets/catalog.json
```
