# Kestra OSS pull 수집 (Gerrit, GHES CSV, PG)

Airbyte 대신 Kestra OSS 흐름으로 pull 수집을 한다. 결정, 규칙, 검증 결과는 [ADR-0005](../../docs/adr/airbyte/0005-kestra-pull-ingestion-instead-of-airbyte.md).
**상태: 로컬 compose(Kestra v2.0.9, 목 서버, SeaweedFS S3)에서 `verify/verify.sh` 20개 항목 통과(2026-11-09).** 실제 Gerrit·GHES·사내 S3는 붙여 보지 않았다.

## 요약

- 세 소스를 1시간마다 전체로 받아 원본 그대로 S3 브론즈에 올린다. 흐름마다 동시 실행 1개, 재시도 3번.
- 파일 규칙: `bronze/<source>/<stream>/dt=<예정 날짜>/hr=<예정 시>/<실행 시각>_<실행 ID>.<ext>`(UTC). 다시 돌려도 덮어쓰지 않고, 실버는 폴더마다 스트림이 모두 있는 실행 중 가장 늦은 것 하나를 읽는다(ADR-0005 B1~B7).
- 비밀값은 `secrets/<KEY>` 파일을 실행마다 읽는다. 파일을 바꾸면 재기동 없이 반영된다.
- 실행 결과는 감시 흐름이 `ingest_ops.ingest_run_status`에 남긴다. 화면의 실행 목록으로도 본다.

## 구성

| 파일 | 역할 |
|---|---|
| `flows/ingest/main_dataflow.ingest.gerrit.yml` | Gerrit Account·Project·Group → JSONL 3개 → S3 |
| `flows/ingest/main_dataflow.ingest.ghes_active_users.yml` | `LoopUntil` + `http.Download`로 생성 대기 → 원본 CSV → S3 |
| `flows/ingest/main_dataflow.ingest.pg_users.yml` | `CopyOut` CSV(헤더) → 0건이면 실패 → S3 |
| `flows/ingest/main_dataflow.ingest.setup_kv.yml` | KV 설정값을 입력값으로 넣고 바꿈(운영자가 값만 바꾸는 경로) |
| `flows/watch/main_dataflow.system.ingest_watch.yml` | 수집 흐름의 SUCCESS·FAILED를 PG 표에 기록 |
| `flows/system/main_dataflow.system.git_sync.yml` | 인스턴스를 나눌 때만. Git main → 흐름·namespace file(마운트하지 않음) |
| `_files/gerrit/gerrit.py` | Gerrit 세 스트림 수집. 표준 라이브러리만 |
| `mock/server.py` | Gerrit·GHES 목 서버(표준 라이브러리만, 로컬 전용) |
| `pg-init/01-init.sql` | compose postgres에 `source_users`(시험 소스 500행), `ingest_ops`(실행 결과 표) 생성 |
| `s3/s3.json` | 로컬 SeaweedFS S3 자격 증명 |
| `tests/` | 단위 시험, 목 서버 시험(Kestra 없이) |
| `verify/verify.sh` | 스택을 띄워 ADR-0005 검증을 처음부터 끝까지 돌림 |
| `compose.yaml` | 초기 운영·로컬 개발 단일 compose |

흐름 파일 이름은 `main_<namespace>.<id>.yml`이어야 한다. v2.0.9 파일 감시는 파일명의 첫 `_` 앞을 테넌트로 읽는다.

## 로컬 실행

```bash
cd kestra/ingest
./verify/verify.sh                 # 비밀값 파일이 없으면 시험용으로 만들고, 스택을 띄워 전체 검증
VERIFY_RESET=1 ./verify/verify.sh  # 볼륨까지 지우고 처음부터(로컬 전용)
uvx pytest -q tests                # Kestra 없이 단위·목 서버 시험만
```

화면: <http://localhost:8080> (`admin@example.com` / `Kestra1234`). 처음에는 `setup_kv`를 한 번 실행한다.

## 설정값

| 종류 | 키 | 바꾸는 곳 |
|---|---|---|
| KV (`dataflow.ingest`) | `GERRIT_URL`, `GERRIT_PAGE_SIZE`, `GHES_BASE_URL`, `PG_URL`, `PG_TABLE`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION` | `setup_kv` 입력값 또는 KV 화면 |
| KV (`dataflow.system`) | `OPS_PG_URL` | `setup_kv` |
| 실행 입력 | `ghes_active_users`의 `interval`, `max_wait`(ISO-8601 문자열, 예 `PT30S`) | 실행할 때 화면에서 |
| 비밀값 | `GERRIT_USERNAME`, `GERRIT_PASSWORD`, `GHES_PAT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_KEY_ID`, `PG_USERNAME`, `PG_PASSWORD`, `OPS_PG_USERNAME`, `OPS_PG_PASSWORD` | `secrets/<KEY>` 파일. 재기동 없음 |

`setup_kv`의 기본값은 로컬 compose 기준이다(목 서버, SeaweedFS `http://s3:8333`, compose postgres). 운영에서는 입력값만 바꿔 실행한다.

## 비밀값

- `./secrets`(Git 제외, 700)를 디렉터리째 `/run/secrets`에 읽기 전용으로 마운트한다. 파일은 평문 한 줄(600).
- 흐름은 `read('file:///run/secrets/<KEY>') | trim`, Gerrit 스크립트는 `<KEY>_FILE` 경로로 실행마다 읽는다. `kestra.local-files.allowed-paths: [/run/secrets]`로 이 경로만 허용한다.
- 파일 단위 마운트와 compose `secrets:`는 쓰지 않는다. 편집기가 새 inode로 저장하면 컨테이너가 옛 내용을 본다.
- `read()` 값은 `secret()`과 달리 로그 마스킹 대상이 아니다. 로그와 출력에 남기지 않는다.
- 지금 compose는 kestra를 root로 실행한다. 비 root(공식 이미지 uid 1000)로 바꾸면 파일 소유자를 1000으로 맞춘다.

## 변경 흐름

| 파일 | 로컬 시험 | 운영 반영(단일 compose) |
|---|---|---|
| `_files/gerrit/gerrit.py` | `uvx pytest -q tests` | PR 병합 → 호스트 `git pull`(마운트라 다음 실행부터 반영) |
| `flows/**/*.yml` | `docker compose up` 후 화면에서 실행(파일 감시로 반영) | PR 병합 → 호스트 `git pull`(파일 감시 반영) |
| `mock/server.py` | `uvx pytest -q tests` | 운영에 올리지 않음(운영 compose에서는 목 서버를 뺀다) |
| KV | `setup_kv` | `setup_kv` 입력값 |
| 비밀값 | `secrets/<KEY>` | 호스트 `secrets/<KEY>` 교체(재기동 없음) |

## 목 서버

| 환경 변수 | 기본값 | 뜻 |
|---|---|---|
| `MOCK_GERRIT_ACCOUNTS` / `PROJECTS` / `GROUPS` | 250 / 250 / 200 | 건수(Group 200은 페이지 100의 배수라 빈 페이지까지 받는다) |
| `MOCK_GERRIT_DUP` | 0 | 1이면 맵 페이지마다 앞 페이지 마지막 항목을 다시 준다 |
| `MOCK_FAIL_FIRST` | 0 | 처음 N번 요청에 503 |
| `MOCK_GHES_PENDING` | 2 | CSV 전 생성 중 응답 수 |
| `MOCK_GHES_MODE` | 202 | 생성 중 응답 방식: `202` 또는 `empty`(200 + 빈 본문) |

셸 변수로 바꿔 띄운다. 예: `MOCK_GHES_MODE=empty docker compose up -d --no-deps mock-ghes`.

## 실버에서 읽을 때

- 스냅샷 선택(B4)과 파일명 열 사용 예는 `verify/silver_check.py`.
- PG CSV는 `read_csv(..., all_varchar = true, allow_quoted_nulls = false)`로 읽는다. 기본값은 빈 문자열(`""`)도 NULL로 읽는다.
