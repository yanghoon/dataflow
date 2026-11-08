# pull 수집(Gerrit, GHES CSV, PG)을 Airbyte 대신 Kestra OSS 흐름으로 시작한다

에어갭 사내 환경에서 지금 세 pull 소스(Gerrit Account·Project·Group, GHES active users CSV, PG 사용자 테이블)는 모두 매번 전체를 받는다.
Airbyte의 장점(커넥터 폭, 증분 상태 관리, 연결 설정 양식 화면)은 이 조건에서 효과가 작고, GHES CSV의 생성 대기(`202`, `200` + 빈 본문)는 Airbyte에서 코드 없이 처리하지 못한다.
그래서 수집을 Kestra OSS 흐름으로 시작하고, 증분 요구나 운영자 양식 화면 요구가 생기면 Airbyte를 다시 검토한다.
초기 운영은 단일 docker compose이고, 비밀값은 마운트한 파일을 실행마다 `read('file://...')`로 읽어 재기동 없이 바꾼다.
사람별 역할 권한이나 비밀값 암호화·로그 마스킹이 요구로 확정되면 Airflow로 바꾼다.

## Status

Accepted (2026-11-09). 필수 검증 5개(1, 2, 8, 13, 16)를 로컬 compose(Kestra v2.0.9, 목 서버, SeaweedFS S3)에서 통과했다(`kestra/ingest/verify/verify.sh`, 20개 항목 PASS). 결과는 아래 "검증 결과". 실제 Gerrit·GHES·사내 S3로만 확인할 수 있는 항목(3, 4, 12)과 화면이 필요한 항목(15)은 남아 있다.
- 처음 기준(Proposed, 2026-11-08): 필수 5개를 통과하면 Accepted. 이 다섯은 실패하면 설계(GHES 대기, 비밀값, 파일 규칙, 감시)를 다시 해야 하고, 나머지는 설정·코드만 고치면 된다.
이 ADR은 [ADR-0001](./0001-airbyte-gerrit-custom-connector.md)(Gerrit CDK)과 [ADR-0003](./0003-ghes-active-users-csv-builtin-source.md)(GHES Builder)을 대체한다.

## Context

- 환경: 에어갭 사내망. 외부 SaaS와 퍼블릭 클라우드에 붙는 커넥터는 쓸 수 없다.
- 소스: Gerrit Account·Project·Group(REST, 페이지 넘기기, `)]}'` 접두사), GHES `active_users.csv`(생성에 약 10분), PG 사용자 테이블(약 5만 건). 모두 매번 전체를 받는다.
- 시험: 실제 Gerrit·GHES 없이 목 서버로 확인한다. 목 서버는 아래 "Gerrit REST 사실"을 따른다.
- 운영: 개발(L3)과 운영(L2)이 다른 사람이다. 운영자는 실행 상태를 보고 다시 돌릴 수 있어야 한다.
- Kestra OSS는 2단계 실행 도구로 이미 들어온다(`transform-layer.md` C47). OIDC 로그인과 사람별 감사 로그는 `kestra/` PoC로 검증했다(kestra ADR-0001, 0002).

## 검토 결과

### Airbyte 커넥터 (2026-11-08 OSS 레지스트리, 소스 592 · 목적지 54)

- 에어갭에서 개발 없이 붙는 것은 DB, S3 호환 저장소, SFTP, 일부 사내 설치형 서비스(GitHub Enterprise Server, GitLab, Jira, Sentry 등)뿐이다. 상세는 `docs/evolution/transform-layer.md` 부록 E.
- Gerrit 커넥터는 없다. GHES는 공식 GitHub 커넥터가 `api_url`로 붙을 수 있으나 사용자 CSV를 대신할 스트림이 있는지 미확인이다.

### Gerrit REST 사실 (문서와 master 소스)

| 대상 | 엔드포인트 | 응답 형태 | 페이지 넘기기 | 끝 판정 |
|---|---|---|---|---|
| Account | `/a/accounts/?q=is:active OR is:inactive&o=DETAILS&n=&S=` | 배열 | `n`, `S` | 마지막 레코드의 `_more_accounts: true` |
| Project | `/a/projects/?d&all&n=&S=` | 이름을 키로 한 맵 | `n`, `S` | 마지막 항목의 `_more_projects: true`(`ListProjectsImpl`) |
| Group | `/a/groups/?o=MEMBERS&o=INCLUDES&n=&S=` | 이름을 키로 한 맵. 값에 `name` 없음 | `n`, `S` | 끝 표시 없음(`ListGroups`). 받은 건수가 `n`보다 적으면 끝 |

- 모든 응답 앞에 `)]}'` 한 줄이 붙는다. `/a/` 경로는 HTTP 인증을 요구한다.
- Group 목록은 내부 그룹만 준다(`GroupDescription.Internal`). 멤버(`o=MEMBERS`)와 하위 그룹(`o=INCLUDES`)은 요청할 때만 온다.
- Query 방식(`/projects/?query=`, `/groups/?query=`)은 배열과 `limit`·`start`를 쓰고 `_more_*`를 붙이지만, 이 결정은 List 방식을 쓴다.
- Project 목록은 기본으로 `HIDDEN`을 뺀다. 전체 스냅샷(IR1)을 위해 `all`을 붙인다.

### Gerrit 데이터 (기준: REST 엔터티 정의 + 요청 옵션)

| 스트림 | 기본 키 | 받는 필드 |
|---|---|---|
| Account(`AccountInfo`, `o=DETAILS`) | `_account_id` | `name`, `display_name`, `email`, `username`, `status`, `tags`, `avatars`, `inactive`, `deleted`. `secondary_emails`는 받지 않는다(ALL_EMAILS·관리 권한 필요) |
| Project(`ProjectInfo`, `d`, `all`) | `id`(URL 인코딩된 이름) | `name`(맵 키), `parent`, `description`, `state`(`ACTIVE`·`READ_ONLY`·`HIDDEN`), `web_links` |
| Group(`GroupInfo`, `o=MEMBERS`, `o=INCLUDES`) | `id`(URL 인코딩된 UUID) | `name`(맵 키), `group_id`, `owner`, `owner_id`, `description`, `created_on`, `url`, `options.visible_to_all`, `members[]`(직접 멤버, 상세 AccountInfo), `includes[]`(직접 하위 그룹, GroupInfo) |

- 관계: `members[]._account_id` → Account, `includes[].id`·`owner_id` → Group, `parent` → Project `name`. 외부 그룹(LDAP 등)은 Group 목록에 없어 `includes`에서 끊긴다.
- 간접 멤버는 실버에서 `includes`를 펼쳐 만든다.
- `inactive`·`deleted`·`visible_to_all`은 false면 필드가 없다. 실버는 없음을 false로 읽는다.
- JSONL에는 받은 필드를 그대로 둔다. 스키마는 소스를 따르고 실버에서 정한다.

### GHES CSV 생성 대기

| 도구 | `202` | `200` + 빈 본문 | 원본 CSV |
|---|---|---|---|
| Airbyte File 소스(HTTP) | 재시도 없음. 본문을 CSV로 파싱 | 재시도 없이 실패 | 레코드로 바뀜 |
| Airbyte Builder(ADR-0003) | 재시도 | 0건 성공(감지 못함) | 레코드로 바뀜 |
| Airbyte Python CDK | 처리 가능(코드) | 처리 가능(코드) | 레코드로 바뀜 |
| Kestra `LoopUntil` + `http.Download` | 처리(YAML) | 처리(YAML) | 그대로 보존 |

- File 소스는 파일 열기 예외에만 5회 지수 백오프로 재시도한다. smart_open은 `202`를 정상으로 본다(`source_file/client.py`, `smart_open/http.py`).

### Kestra OSS 기능

| 항목 | 내용 |
|---|---|
| 구조 | webserver, executor, scheduler, worker. `server standalone`은 한 프로세스. 플러그인은 worker JVM 안에서 돈다 |
| 커스텀 로직 | Pebble 식(값 끼우기·조건), 스크립트 작업(Process 또는 Docker 실행기), Java 플러그인 |
| 기본 이미지 | Python이 들어 있는 유일한 언어. 패키지는 없음 |
| 비밀값(`secret()`) | `SECRET_` 접두사 + base64 환경 변수. `SecretService`가 기동 시(`@PostConstruct`) 한 번만 읽어 바꾸려면 재기동. 외부 비밀 저장소는 Enterprise |
| 비밀값(`read()`) | `read('file://...')`가 `kestra.local-files.allowed-paths`의 파일을 렌더링마다 읽음. 파일 함수는 기본 켜짐(`LocalFilesConfiguration`). 로그 마스킹 대상 아님(`secret()`만 `consumeSecret`) |
| 재실행 | 실패 작업부터 재시작(restart), 지정 작업부터 새 실행(replay, 리비전·새 입력·중단점 지정), 일괄 restart·replay, 상태 변경, 일시정지·재개, Schedule 백필(입력 지정, 일시정지 가능). 모두 OSS webserver API(`ExecutionController`, `TriggerController`) |
| 화면 | 흐름 YAML 편집, 실행, 재실행, 리비전 비교·되돌리기 |
| Git | `git.SyncFlows`, `git.SyncNamespaceFiles`로 Git → Kestra 반영 |
| Enterprise 전용 | RBAC, SSO, 감사 로그, 비밀 저장소, 흐름 단위 테스트, Apps, Worker Groups |

### Kestra가 못 하는 Airbyte 장점 (OSS 기준)

- 커넥터 spec에서 만든 연결 설정 양식 화면
- 스키마 탐지, 스트림·열 선택, 스키마 변경 반영
- 동기화 방식(전체, 증분 추가, 중복 제거)과 커서 상태 자동 관리, 체크포인트 이어 받기
- 추적 정보 자동 부착(`_airbyte_raw_id`, `_airbyte_extracted_at` 등)
- 목적지 타입 표 적재와 중복 제거
- Connector Builder(인증, 페이지 넘기기, 증분을 화면에서 만들고 시험)

### 비밀값 교체 (재기동 없이)

| 방법 | 판단 |
|---|---|
| `secret()` + 환경 변수 | 기각(기본 경로로 쓰지 않음). 교체마다 재기동. standalone은 실행 중 작업이 끊긴다 |
| `kv()` | 기각. 평문, 화면 노출, RBAC 없음 |
| **`read('file:///run/secrets/<KEY>')` + 디렉터리 마운트** | **채택.** 추가 구성 요소·코드 없음. YAML 작업에도 쓴다 |
| 스크립트가 `<KEY>_FILE` 경로로 직접 읽음 | 채택(Gerrit). 같은 파일을 쓴다 |
| 비밀 저장소 서버 + `http.Request(encryptBody)` | 보류. 출력이 AES 암호화되고 복호화 시 마스킹되지만 서버가 하나 더 들고, 접속 토큰은 여전히 필요 |
| `SecretService` 교체(`@Replaces`) | 기각. 문서 없는 내부 API, 확장 jar 금지(kestra ADR-0001 제약) |
| 분산 모드 worker 다중화 + 순차 재기동 | 보류(초기 단일 compose 범위 밖). 종료 worker는 실행 중 작업을 유예 시간(기본 5분, `ServerConfig`)만큼 기다리고, 남은 작업은 기본 전략으로 재제출 |

### 재실행 비교 (OSS)

| 기능 | Kestra | Airflow | Airbyte |
|---|---|---|---|
| 실패한 곳부터 다시 | restart(실패 task run부터) | 실패 task clear | sync 단위. 자동 재시도 시도(attempt) |
| 중간 작업부터 다시 | replay(task run 지정, 리비전·입력 변경) | 특정 task와 하위 clear | 없음(스트림 단위 상태) |
| 지난 기간 채우기 | Schedule 백필(입력·일시정지) | backfill | 없음(증분 커서로 이어 받기) |
| 일괄 처리 | restart·replay·kill·상태 변경 by-ids/query | 다중 clear | 없음 |

이 흐름에서 업로드만 실패하면 restart가 업로드만 다시 돈다. 앞 작업의 결과 파일(내부 저장소)을 그대로 쓴다(미검증).

### 세 구성 비교 (수집 + 실행 도구, OSS)

2단계 변환·발송에 실행 도구가 어차피 필요하므로 수집 도구 단독이 아니라 구성으로 비교한다.

| 관점 | A. Airbyte + Kestra | B. Kestra 단독 | C. Airflow 단독 |
|---|---|---|---|
| 신뢰성 | 체크포인트·증분 상태 자동. 전체 받기 소스라 효과 작음. GHES 빈 본문은 CDK 필요 | 재시도·대기를 YAML로 선언. 재기동 시 작업 재제출. 초기 compose는 단일 장애 지점 | 재시도·센서·백필 성숙. 필수 구성 요소가 많음 |
| 확장성 | 증분 강함. 에어갭 커넥터는 좁음 | worker 확장, 병렬. DB·HTTP·SFTP·S3 플러그인 포함 | Celery·K8s 실행기. 필요한 provider 기본 포함 |
| 구성 요소 | K8s 위 Airbyte(권장 4코어·8GB) + Kestra + PG | Kestra + PG | scheduler, dag-processor, api-server + PG |
| 커스텀 코드 | Gerrit CDK, GHES Builder(+빈 본문용 CDK) | Gerrit 스크립트 하나(표준 라이브러리). GHES·PG는 YAML | Gerrit 스크립트 + DAG + GHES 다운로드 코드 |
| 비밀값 | 화면 수정. 기본 DB 평문 저장 | 파일 `read()`로 재기동 없이 교체. 평문, 마스킹 없음 | 화면 수정. Fernet 암호화, 마스킹 |
| 인증·권한 | 도구마다 계정 하나 | 계정 하나. 프록시로 SSO·감사 로그 검증. 역할은 설계만 | FAB 역할, DAG별 권한, SSO |
| 재실행 | sync 단위 | restart, replay, 일괄, 백필 | clear, backfill |
| 중복 투자 | 도구 둘 | 2단계 실행 도구 재사용 | 실행 도구 하나 |

B를 고른다. 구성 요소와 커스텀 코드가 가장 적고 2단계 실행 도구를 그대로 쓴다. C는 권한과 비밀값 보호에서 앞서며, 그 둘이 전환 조건이다.

### 인증·권한

- Airbyte Core와 Kestra OSS 모두 계정 하나다. SSO와 RBAC는 둘 다 Enterprise다.
- Kestra는 oauth2-proxy로 OIDC 로그인과 사람별 감사 로그가 검증됐다. 역할 구분은 게이트웨이 설계만 있다(kestra ADR-0003, 미검증).

## Decision

- pull 수집은 Kestra OSS 흐름으로 한다. 받은 원본을 그대로 S3 브론즈에 올린다.
  - **Gerrit:** Account·Project·Group 세 스트림을 Python 스크립트(표준 라이브러리만)로 받아 스트림마다 JSONL로 쓴다. Process 실행기로 돌리고, 기본 이미지 그대로 쓰며 pip 설치가 없다. 맵 응답(Project, Group)은 키를 `name` 필드로 옮겨 레코드로 쓴다.
  - **GHES CSV:** `LoopUntil` 안에서 `http.Download`를 반복한다. `200`이고 크기가 0보다 클 때 멈춘다. 최대 대기를 넘으면 실패한다.
  - **PG:** `jdbc.postgresql.CopyOut`(`format: CSV`, `header: true`)으로 사용자 테이블 전체를 CSV로 받는다. 브론즈에서는 타입이 문자열이 되고, 타입은 실버가 정한다. PG CSV는 NULL을 따옴표 없는 빈 값, 빈 문자열을 `""`로 써서 둘을 구분한다.
- 추적 정보는 S3 경로에 실행 날짜와 실행 ID를 넣어 대신한다.
- 수집 주기는 모든 소스(Gerrit, GHES, PG) 1시간이다(초기값). 주기는 흐름의 Schedule 트리거에 두고 코드에 두지 않는다. 흐름 트리거는 `cron: "0 * * * *"`, `timezone: UTC`다.
- 실패 확인: 초기에는 운영자가 Kestra 화면의 실행 목록(상태 FAILED)으로 본다. SQL로도 볼 수 있게 감시 흐름 하나를 둔다. `Flow` 트리거(`dataflow.ingest` 네임스페이스의 SUCCESS·FAILED)로 시작해 `jdbc.postgresql.Query`로 표 `ingest_run_status`(흐름, 예정 시각, 실행 ID, 상태, 끝난 시각)에 한 줄 넣는다. 표는 compose postgres 안의 별도 DB `ingest_ops`에 둔다. Kestra 내부 표는 구조가 문서화되지 않아 직접 조회하지 않는다. SMTP 알림은 두지 않는다.
- 흐름마다 동시 실행은 1개다(`concurrency.limit: 1`, `behavior: QUEUE`). 앞 실행이 끝나지 않았으면 새 실행은 대기열에서 기다린다. 늦게 돌아도 폴더는 예정 시각(B1)으로 정해진다.
- 브론즈는 기간 제한 없이 모두 보관한다. 하루에 Gerrit 72개(3 스트림 × 24), GHES 24개, PG 24개가 쌓인다. 보관 기간은 저장 용량을 보고 나중에 정한다(스냅샷 크기는 미확인).
- **스냅샷**은 성공한 실행 하나가 남긴 객체 묶음이다(Gerrit은 세 스트림, GHES는 CSV 하나). 기준 시각은 실행 시작 시각(`execution.startDate`)이고, 같은 시각은 실행 ID로 구분한다. 같은 기간에 스냅샷이 여럿이면(restart, replay, 백필, 수동 실행) 실버는 가장 늦게 시작한 실행의 것 하나만 쓴다. 실패한 실행은 스냅샷이 아니다.
  - 완료 표시 파일이나 `.tmp` 접미사는 두지 않는다. 업로드 도중 실패해 스트림이 일부만 남은 실행은 실버가 "같은 실행 ID의 스트림이 모두 있는가"로 걸러 낸다. 남은 객체는 지우지 않는다.

### 구현에서 정해진 것 (Kestra v2.0.9에서 확인)

| 항목 | 결정 | 이유 |
|---|---|---|
| 흐름 파일 이름 | `main_<namespace>.<id>.yml` | v2.0.9 파일 감시는 파일명의 첫 `_` 앞을 테넌트로 읽는다(`FileChangedEventListener.getTenantIdFromPath`, `split("_")[0]`). develop은 고쳐졌다 |
| S3 설정 | 업로드 작업마다 직접 쓴다 | v2.0.9 흐름에는 `pluginDefaults` 필드가 없다(검증 오류 "Unrecognized field") |
| S3 경로 방식 | `forcePathStyle: true` + `compatibilityMode: true` | 이미지의 aws 플러그인이 둘을 함께 요구한다. 전송 한도 약 2GB(지금 스냅샷은 수십~수백 KB) |
| GHES 간격·최대 대기 입력 | STRING(`PT30S`, `PT15M`) | DURATION 입력은 실행 기록에 초 숫자(`20.0`)로 남아 `LoopUntil`에 넘기면 최대 대기가 의도대로 걸리지 않았다(20초 지정에 약 2분) |
| Gerrit 스크립트 위치 | 단일 compose에서는 `_files/`를 컨테이너에 마운트해 경로로 실행 | 파일 감시는 흐름만 반영한다. 인스턴스를 나누면 `SyncNamespaceFiles` |
| 로컬 S3 | SeaweedFS S3 게이트웨이 | MinIO 커뮤니티 이미지를 받을 수 없다(Docker Hub·quay 모두 거부) |
| 감시 흐름 기록 | `execution_id` 기준 upsert | 재시도 뒤 실패한 실행 하나에 감시 흐름이 여러 번 돌았다 |
| 실버의 PG CSV 읽기 | DuckDB `read_csv(..., allow_quoted_nulls = false)` | 기본값은 `""`(빈 문자열)도 NULL로 읽는다. 끄면 PG의 NULL과 빈 문자열이 구분된다 |

### 브론즈 파일 규칙 (pull 수집 공통: Gerrit, GHES, PG)

```
bronze/<source>/<stream>/dt=<YYYY-MM-DD>/hr=<HH>/<run_ts>_<execution_id>.<ext>
예) bronze/gerrit/account/dt=2026-11-08/hr=13/20261108T130002Z_aB3x….jsonl   정시 실행
    bronze/gerrit/account/dt=2026-11-08/hr=13/20261108T160510Z_Qz9k….jsonl   16시에 13시분 백필
    bronze/ghes/active_users/dt=2026-11-08/hr=13/20261108T130105Z_Lm2p….csv
```

| ID | 규칙 |
|---|---|
| B1 | 폴더(`dt`, `hr`)는 "몇 시분 데이터인가"다. 예정 시각 `trigger.date`(UTC)로 만들고, 트리거가 없는 수동 실행만 `execution.startDate`를 쓴다. 백필의 `trigger.date`는 백필 중인 예정 시각이다(`Schedule.java`). Schedule 트리거의 `timezone`은 UTC로 둔다 |
| B2 | 파일명은 "언제 받았나"다. `run_ts`는 `execution.startDate`의 UTC `yyyyMMdd'T'HHmmss'Z'`(`:` 없음), `execution_id`는 Kestra 실행 ID(무작위 UUID의 Base62 22자, 영숫자)다 |
| B3 | 덮어쓰지 않는다. replay, 백필, 재실행은 새 실행이라 같은 폴더에 새 파일이 생긴다. 같은 실행의 작업 재시도와 restart는 같은 키에 같은 내용을 다시 쓴다(멱등) |
| B4 | 실버는 폴더마다 "스트림이 모두 있는 실행 중 파일명이 가장 큰 것" 하나를 읽는다. 이름순이 받은 시각순이다 |
| B5 | 여러 인스턴스가 같은 폴더에 써도 실행 ID가 달라 충돌하지 않는다. B4로 하나가 고른다 |
| B6 | 한 실행의 스트림은 파일 하나다(분할 없음). 분할이 필요해지면 완료 표시 파일과 함께 규칙을 다시 정한다 |
| B7 | 지난 시간대를 다시 받을 때는 수동 실행이 아니라 백필을 쓴다(수동 실행은 현재 시간대 폴더로 간다) |

선례: 폴더의 `key=value` 시간 분할은 Hive 파티션 관례이고, Kafka Connect S3 sink의 TimeBasedPartitioner(`year=/month=/day=/hour=`)와 같다. 파일명에 시각·고유값을 넣는 것은 Airbyte S3 목적지(`<날짜>_<epoch>_<part>`), Kafka Connect(`<topic>+<partition>+<startOffset>`)와 같은 방식이다. DuckDB는 `dt`·`hr` 조건으로 필요한 폴더만 읽는다(hive 파티션 필터 푸시다운).
- 초기 운영은 단일 docker compose(`kestra/ingest/compose.yaml`)로 한다.
- 비밀값은 호스트 `secrets/<KEY>` 파일(평문 한 줄, 디렉터리 700·파일 600, Git 제외)로 두고, 디렉터리째 `/run/secrets`에 읽기 전용으로 마운트한다. `kestra.local-files.allowed-paths: [/run/secrets]`로 이 경로만 허용한다. YAML 작업은 `read('file:///run/secrets/<KEY>') | trim`, 스크립트는 `<KEY>_FILE` 경로로 실행마다 읽는다. 파일을 바꾸면 재기동 없이 다음 실행부터 반영된다.
  - 파일 단위 마운트와 compose `secrets:`는 쓰지 않는다. 편집기가 새 inode로 저장하면 옛 내용이 남는다.
  - `read()` 값은 로그 마스킹 대상이 아니므로 로그·출력에 남기지 않는 것을 흐름 작성 규칙으로 둔다.
- 흐름과 스크립트는 Git이 원본이다. 단일 compose에서는 호스트 `git pull`과 파일 감시로 흐름을 반영한다. 인스턴스를 나누면 `SyncFlows`, `SyncNamespaceFiles`로 main을 받는다. 설정값은 KV다.
- **화면에서 흐름 수정은 초기에는 허용한다.** Git으로만 바꾸게 하는 잠금은 설정으로 남겨, 필요할 때 값만 바꿔 켠다.
  - 잠금 설정 1(화면): 흐름 라벨 `system.readOnly`. 초기값 `"false"`, 켜면 `"true"`. UI 편집기가 읽기 전용이 된다(`ui/src/stores/flow.ts`). 사용자가 붙일 수 있는 유일한 시스템 라벨이다(`FlowValidator`).
  - 잠금 설정 2(API): 앞단 프록시의 흐름 쓰기 차단(`POST`·`PUT`·`DELETE /api/v1/*/flows…`). 초기값 꺼짐. 서버 API는 `system.readOnly`를 검사하지 않으므로 화면 잠금만으로는 API 수정을 막지 못한다. 파일 감시와 `SyncFlows`는 프록시를 거치지 않아 영향이 없다(kestra ADR-0003 설계, 미검증).
  - 잠금을 켜는 조건: 화면 수정으로 사고가 나거나, 비밀값 노출 경로를 줄여야 할 때. 켜면 실행·재실행·KV 수정은 화면에 그대로 남는다.
- Airbyte를 다시 검토하는 조건: 증분 수집이 필요한 소스가 여럿 생길 때, 늘어날 소스에 쓸 수 있는 Airbyte 커넥터가 있을 때, 운영자가 연결 설정을 양식 화면으로 바꿔야 할 때.
- Airflow로 바꾸는 조건: 운영자·개발자의 역할 권한 구분이 요구로 확정되고 게이트웨이 방식(kestra ADR-0003) 검증이 실패할 때, 또는 비밀값 저장 암호화·로그 마스킹이 요구로 확정될 때.
- 분산 구성으로 옮기는 조건: Kestra 설정 변경 재기동으로 실행이 끊기는 것을 받아들일 수 없거나, 단일 장애 지점이 문제가 될 때. worker를 2개 이상 두고 순차 재기동한다.

## Considered Options

| 옵션 | 결과 |
|---|---|
| Airbyte 유지(CDK + Builder) | 보류. GHES `200` 빈 본문을 처리하려면 CDK가 필요하고, 세 소스에 Airbyte 장점의 효과가 작다 |
| Airbyte File 소스로 GHES | 기각. 생성 대기 재시도가 없다 |
| Airbyte + Kestra 혼용(GHES만 Kestra) | 기각. pull 도구가 둘이 되어 "수집 단일 도구"에 어긋난다 |
| Gerrit를 YAML만으로(`LoopUntil` + `http.Request`) | 기각. 접두사 제거와 JSON 파싱을 Pebble로 해야 해 취약하다 |
| Gerrit를 Docker 실행기로 | 기각. 소켓 연결, 이미지 반입, 기동 시간이 든다 |
| Gerrit를 Java 플러그인으로 | 보류. jar 빌드와 재기동 부담. 로직이 커지면 재검토 |
| PyAirbyte로 기존 커넥터 실행 | 보류. 에어갭에서 레지스트리 조회를 끌 수 있는지 미확인 |

## Consequences

- 무거운 서비스(Airbyte)가 빠지고 실행·수집 화면이 Kestra 하나로 모인다.
- GHES CSV를 원본 파일 그대로 보존한다. 1단계에서 받아들인 원본 보존 예외가 사라진다.
- 위 "Kestra가 못 하는 Airbyte 장점"을 잃는다. 증분이 필요하면 KV에 커서를 두고 직접 짠다.
- Airbyte로 옮길 때 수집 로직은 다시 만든다. 브론즈 경로와 추적 정보 규칙을 미리 정해 실버 SQL은 남게 한다.
- 비밀값 교체에 재기동이 없다. 대신 비밀값이 호스트 파일에 평문으로 있고(저장 시 암호화 없음), `read()` 값은 로그 마스킹이 되지 않는다.
- 화면 수정을 허용하므로, Kestra 화면에 들어올 수 있는 사람은 흐름을 고쳐 비밀값을 로그로 볼 수 있다. 초기에는 이 위험을 받아들이고, 화면 접속을 SSO 프록시로 L2·L3에 한정해 줄인다. 더 줄여야 하면 잠금 설정 1·2를 켠다.
- 단일 compose의 standalone 한 프로세스가 단일 장애 지점이다. Kestra 설정을 바꾸는 재기동 때는 실행 중 작업이 끊길 수 있다.

### 남는 단점 (다른 두 도구 대비)

| 단점 | 더 나은 쪽 |
|---|---|
| 사람별 역할 권한 없음(게이트웨이 설계만, 미검증) | Airflow(FAB 역할, DAG별 권한) |
| 비밀값 저장 시 암호화 없음, `read()` 값 로그 마스킹 없음 | Airflow(Fernet, 마스킹) |
| 연결 설정 양식 화면, 스키마 탐지, 증분 상태 자동 관리 없음 | Airbyte |
| standalone 단일 장애 지점(초기 compose) | 분산 구성 시 셋 다 해소 가능 |

## 구현 요구사항

Gerrit·GHES 수집 코드(스크립트든 YAML이든)가 지켜야 할 조건이다. 각 항목은 목 서버(`kestra/ingest/mock/server.py`)로 확인한다.

### 공통

| ID | 요구 | 확인 |
|---|---|---|
| IR1 | 매 실행이 소스 전체를 받는다(증분 없음) | 목 서버 전체 건수와 결과 건수가 같다 |
| IR2 | 결과는 "브론즈 파일 규칙" B1~B7을 따른다 | 정시 실행과 같은 시간대 백필이 같은 폴더에 파일 둘을 남기고, 이름순이 받은 시각순이다 |
| IR3 | 추적 정보는 경로의 실행 날짜·실행 ID로 대신한다. 레코드의 의미를 바꾸지 않는다. 허용하는 변경은 맵 키를 `name`으로 옮기기와 페이지 표시 필드(`_more_*`) 지우기뿐이다 | 결과 레코드에서 `name`과 `_more_*`를 빼면 소스 응답과 같다 |
| IR4 | 비밀값은 `/run/secrets/<KEY>` 파일을 실행마다 읽는다. 값은 로그·출력·예외 메시지에 남기지 않는다 | 파일을 바꾼 뒤 재기동 없이 다음 실행이 새 값으로 인증한다. 실행 로그에 값이 없다 |
| IR5 | 설정값(주소, 페이지 크기, 버킷, endpoint)은 KV에서 읽는다. 코드에 상수로 두지 않는다 | `setup_kv` 입력만 바꿔 다른 주소로 붙는다 |
| IR6 | 받기·업로드 작업에 Kestra 작업 재시도(지수 간격, 최대 3번, 총 10분)를 건다. 재시도를 다 써도 실패하면 실행이 실패한다. 빈 결과를 성공으로 올리지 않는다. Kestra 재시도는 오류 종류를 가리지 않으므로(`AbstractRetry`는 `maxAttempts`·`maxDuration`·`behavior`만 있음) 401·403도 재시도 뒤 실패한다 | 목 서버가 5xx를 두 번 주고 정상 응답하면 성공한다. 틀린 자격 증명이면 재시도 뒤 실패하고 S3 객체가 없다 |
| IR7 | 외부 패키지를 쓰지 않는다(표준 라이브러리, Kestra 기본 이미지, Process 실행기) | 기본 이미지에서 pip 없이 돈다 |
| IR8 | 업로드만 실패하면 restart로 업로드만 다시 돈다 | 업로드 실패 후 restart 시 받기 작업이 다시 돌지 않는다(검증 10) |
| IR9 | 한 실행의 스트림은 모두 받은 뒤에 올린다. 받기 도중 실패하면 S3에 아무것도 쓰지 않는다 | Gerrit Group 받기를 실패시키면 Account·Project 객체도 없다 |
| IR10 | 실버는 B4대로 폴더마다 스트림이 모두 있는 실행(Gerrit 3개, GHES 1개) 중 파일명이 가장 큰 것 하나만 읽는다 | 같은 시간대를 백필하면 백필 파일만 읽는다. Group 업로드만 실패한 실행은 읽지 않는다 |

### Gerrit (Account `/a/accounts/`, Project `/a/projects/`, Group `/a/groups/`)

| ID | 요구 | 확인 |
|---|---|---|
| IG1 | Basic 인증으로 세 스트림을 부른다. Account는 `?q=is:active OR is:inactive&o=DETAILS&n=&S=`, Project는 `?d&all&n=&S=`, Group은 `?o=MEMBERS&o=INCLUDES&n=&S=` | 목 서버가 인증과 옵션을 확인한다 |
| IG2 | 응답 앞의 `)]}'` 한 줄을 지우고 JSON으로 읽는다. Account는 배열, Project·Group은 맵이어야 하며 아니면 실패한다 | 단위 시험 |
| IG3 | 페이지 끝 판정: Account는 마지막 레코드의 `_more_accounts`, Project는 마지막 항목의 `_more_projects`, Group은 받은 건수 < `n`. 다음 페이지는 `S`를 받은 건수만큼 늘린다 | 스트림마다 250건, 페이지 100 → 3번 호출, 250건. Group은 정확히 `n`의 배수(200건)일 때 빈 페이지 한 번을 더 받고 끝난다 |
| IG4 | 결과는 스트림마다 파일 하나, 한 줄에 레코드 하나인 JSONL(UTF-8). 맵 응답은 키를 `name`으로 옮긴다(값에 `name`이 있으면 그대로) | 줄 수가 건수와 같고 모든 Project·Group 레코드에 `name`이 있다 |
| IG5 | 스트림 하나라도 0건이면 실패한다(인증·쿼리 문제로 본다) | 목 서버 건수를 0으로 두면 실패 |
| IG6 | 요청마다 시간 제한(30초)을 둔다 | 코드 확인 |
| IG7 | 맵은 이름 순으로 오므로 페이지 사이에 같은 이름이 다시 오면 한 번만 쓴다 | 목 서버가 페이지 경계에서 중복을 주면 건수가 같다 |

### GHES (`/stafftools/reports/active_users.csv`)

| ID | 요구 | 확인 |
|---|---|---|
| IH1 | `Authorization: Bearer <PAT>`(site_admin 스코프)로 부른다 | 목 서버가 인증을 확인한다 |
| IH2 | `202` 또는 `200` + 빈 본문은 생성 중으로 보고 기다렸다 다시 받는다 | `MOCK_GHES_MODE=202`와 `empty` 둘 다 성공 |
| IH3 | 간격과 최대 대기는 실행 입력으로 바꿀 수 있다(기본 30초, 15분). 최대 대기를 넘으면 실패한다 | `MOCK_GHES_PENDING`을 크게 두면 실패 |
| IH4 | `200`이고 본문 크기가 0보다 클 때만 끝낸다. 내용은 검사하지 않는다(헤더만 있는 CSV도 성공). CSV 바이트를 바꾸지 않고 그대로 올린다 | 업로드 객체와 목 서버 CSV가 바이트 단위로 같다. 헤더만 주면 성공한다 |
| IH5 | 생성 중 응답 본문은 저장하지 않는다 | S3에 빈 객체가 없다 |

### PG 사용자 테이블

| ID | 요구 | 확인 |
|---|---|---|
| IP1 | `jdbc.postgresql.CopyOut`(`format: CSV`, `header: true`)으로 테이블 전체를 받는다. 접속 주소와 테이블 이름은 KV, 계정·비밀번호는 `secrets/` 파일이다 | 시험 테이블 건수와 CSV 데이터 행 수가 같다 |
| IP2 | 받은 행이 0건(`rowCount == 0`)이면 업로드하지 않고 실패한다 | 빈 테이블로 실행하면 실패하고 S3 객체가 없다 |
| IP3 | CSV 바이트를 바꾸지 않고 그대로 올린다. 타입은 실버가 정한다 | 업로드 객체와 `CopyOut` 결과가 같다 |

PG 시험 소스: compose의 postgres 컨테이너 안에 Kestra 메타DB(`kestra`)와 별도로 시험 DB `source_users`를 두고 시험용 사용자 테이블을 넣는다. 초기화 SQL(`/docker-entrypoint-initdb.d`)로 만들며, 이 SQL은 볼륨이 비어 있을 때 처음 한 번만 돈다. 운영에서는 KV의 접속 주소만 사내 PG로 바꾼다.

### 목 서버 (`kestra/ingest/mock/server.py`)

- 표준 라이브러리 `http.server` 하나로 두 소스를 흉내 낸다. 자격 증명은 Kestra와 같은 `secrets/` 파일과 비교한다.
- Gerrit: 위 "Gerrit REST 사실"대로 세 엔드포인트를 흉내 낸다. Account는 배열과 `_more_accounts`, Project는 맵과 `_more_projects`, Group은 맵(값에 `name` 없음)과 끝 표시 없음. 모두 `)]}'` 접두사. 스트림별 건수는 환경 변수로 정한다(Account `MOCK_GERRIT_ACCOUNTS`는 구현됨, Project·Group은 구현 예정).
- 실제 Gerrit·GHES는 시험에 쓰지 않는다. 목 서버가 실제와 다를 위험은 "Gerrit REST 사실"을 근거로 줄인다.
- GHES: 생성 중 응답 수 `MOCK_GHES_PENDING`(기본 2), 방식 `MOCK_GHES_MODE`(`202` | `empty`). CSV를 준 뒤 다시 센다.
- 실제 GHES CSV의 열 구성과 실제 생성 중 응답(ADR-0003 V1)은 미확인이다. 목 서버의 CSV는 예시다.

## 검증할 것

1. 공식 이미지(`kestra/kestra`)에 `http.Download`, `LoopUntil`, `aws.s3.Upload`, `jdbc.postgresql.CopyOut`, `git.Sync*`, `scripts.python.Commands`가 들어 있는지
2. `LoopUntil` 조건에서 안쪽 작업 결과(`outputs.download`)를 읽을 수 있는지, `Content-Length`가 없을 때 `length` 값
3. GHES 생성 중 응답이 실제로 `202`인지 `200` + 빈 본문인지(ADR-0003 V1)
4. `s3.Upload`가 사내 S3 호환 저장소에 `endpointOverride`, `forcePathStyle`로 붙는지
5. Process 실행기로 namespace file 스크립트가 기본 이미지의 Python에서 도는지
6. `git.SyncFlows`, `git.SyncNamespaceFiles`가 OSS에서 동작하는지
7. `CopyOut` CSV에서 NULL과 빈 문자열이 실제로 구분되는지, DuckDB가 실버에서 이를 그대로 읽는지
8. 공식 이미지에서 `allowed-paths` 설정과 `read('file:///run/secrets/...')`가 동작하는지, 파일을 바꾼 뒤 다음 실행에서 새 값을 읽는지
9. 작업 속성 렌더링(`read()` 평가)이 worker에서 일어나는지
10. 업로드만 실패했을 때 restart가 앞 작업 결과를 재사용하는지
11. kestra 사용자(비 root)로 실행할 때 비밀값 파일 권한(uid)
12. GHES가 캐시한 보고서를 언제까지 다시 주는지. 1시간 주기에서 같은 보고서를 다시 받을 수 있다
13. 백필 실행에서 `trigger.date`가 예정 시각을 주는지, restart 때 `execution.startDate`가 그대로인지(B1, B3)
14. DuckDB `read_json`·`read_csv`로 S3 glob을 읽을 때 파일명 열(`filename`)을 얻을 수 있는지(B4)
15. `system.readOnly: "true"` 라벨이 UI 편집을 막는지, 프록시 차단 규칙이 화면의 흐름 저장을 막으면서 실행·재실행·KV 수정은 통과시키는지(잠금 설정 1·2)
16. `Flow` 트리거가 다른 흐름의 SUCCESS·FAILED로 감시 흐름을 시작하고, 예정 시각(`trigger.date`)과 실행 ID를 넘겨받는지

## 검증 결과 (2026-11-09, `kestra/ingest/verify/verify.sh`)

| # | 결과 | 내용 |
|---|---|---|
| 1 | 통과(필수) | 필요한 작업 12종이 공식 이미지에 있다(`/api/v1/plugins`): Download, LoopUntil, s3.Upload·Copy, CopyOut, jdbc Query, git.SyncFlows·SyncNamespaceFiles, python.Commands, kv.Set, Fail, Flow 트리거 |
| 2 | 통과(필수) | 목 서버가 202·202·200을 주면 세 번째에서 멈추고, 200 + 빈 본문 방식도 같다. 올린 CSV가 목 서버 원본과 md5가 같다. `Content-Length` 없는 응답은 시험하지 않았다 |
| 3 | 미확인 | 실제 GHES 필요. 두 방식 모두 처리하므로 결정에는 영향 없다 |
| 4 | 부분 | S3 호환(SeaweedFS)에 `endpointOverride`·`forcePathStyle`·`compatibilityMode`로 붙었다. 사내 S3는 미확인 |
| 5 | 통과 | Process 실행기가 기본 이미지의 `/usr/bin/python`(3.12.3)으로 마운트한 스크립트를 돌렸다 |
| 6 | 부분 | 플러그인은 있다. 실제 동기화는 시험하지 않았다(단일 compose는 `git pull`) |
| 7 | 통과(조건) | PG CSV는 NULL을 빈 값, 빈 문자열을 `""`로 쓴다. DuckDB는 `allow_quoted_nulls = false`일 때만 구분한다 |
| 8 | 통과(필수) | 편집기처럼 새 inode로 PAT 파일을 바꾼 뒤 재기동 없이(컨테이너 시작 시각 그대로) 다음 실행이 새 값으로 인증했다. 서버·실행 로그에 비밀값 문자열이 없다 |
| 9 | 미확인 | standalone에서는 구분할 수 없다. 분산 구성으로 옮길 때 확인 |
| 10 | 통과 | S3를 멈춰 업로드만 실패시킨 뒤 restart하면 업로드만 다시 돌고(fetch 시도 1회) 같은 파일명으로 올라간다 |
| 11 | 부분 | 공식 이미지 사용자는 uid 1000(`kestra`). 지금 compose는 root로 돈다. 비 root로 바꾸면 비밀값 파일 소유자를 1000으로 맞춘다 |
| 12 | 미확인 | 실제 GHES 필요 |
| 13 | 통과(필수) | 백필 실행의 `trigger.date`가 예정 시각(10:00, 11:00)이고 결과가 `hr=10`·`hr=11`에 들어간다. 파일명은 실제 실행 시각. restart 뒤에도 `execution.startDate`가 같다 |
| 14 | 통과 | `read_json(..., hive_partitioning = true, filename = true)`로 S3 glob에서 파일명 열과 `dt`·`hr`를 얻는다 |
| 15 | 부분 | `system.readOnly` 라벨은 흐름 검증을 통과한다. 화면 잠금과 프록시 차단은 시험하지 않았다(잠금은 꺼 둔 상태) |
| 16 | 통과(필수) | 감시 흐름이 SUCCESS·FAILED 모두 기록하고, 수집 흐름 출력 `scheduled_at`으로 백필 예정 시각까지 남는다. `setup_kv`는 기록하지 않는다 |

구현 요구사항 확인: IR1·IR2·IR3(250/250/200건, `_more_*` 없음, `name` 있음)·IR4·IR6(5xx 한 번 뒤 재시도 성공, 시도 2회)·IR8·IR9(Group 0건이면 세 스트림 모두 안 올라감)·IR10(B4: 스트림이 빠진 실행은 더 늦어도 제외)·IG1~IG7·IH1~IH5(최대 대기 20초면 약 26초에 실패, 객체 없음)·IP1~IP3 통과. 검증 중 백필 실행 하나가 업로드 도중 끊겨 Account·Project만 남았고, 실버 규칙(B4)이 이 실행을 제외했다.

## 출처

- Airbyte OSS 레지스트리: <https://connectors.airbyte.com/files/registries/v0/oss_registry.json>
- Airbyte source-file: <https://github.com/airbytehq/airbyte/blob/master/airbyte-integrations/connectors/source-file/source_file/client.py>
- smart_open http: <https://github.com/piskvorky/smart_open/blob/develop/smart_open/http.py>
- GHES 보고서: <https://docs.github.com/ja/enterprise-server@3.14/admin/monitoring-activity-in-your-enterprise/exploring-user-activity-in-your-enterprise/accessing-reports-for-your-instance>
- Airbyte RBAC: <https://docs.airbyte.com/access-management/rbac>
- Kestra OSS vs Enterprise: <https://kestra.io/docs/oss-vs-paid>
- Kestra secrets: <https://kestra.io/docs/concepts/secret>
- Kestra Process 실행기: <https://kestra.io/docs/task-runners/types/process-task-runner>
- Kestra http.Download: <https://kestra.io/plugins/core/http/io.kestra.plugin.core.http.download>
- Kestra LoopUntil: <https://kestra.io/plugins/core/flow/io.kestra.plugin.core.flow.loopuntil>
- Kestra s3.Upload: <https://kestra.io/plugins/plugin-aws/s3/io.kestra.plugin.aws.s3.upload>
- Kestra CopyOut: <https://kestra.io/plugins/plugin-jdbc-postgres/io.kestra.plugin.jdbc.postgresql.copyout>
- Kestra git.SyncFlows: <https://kestra.io/plugins/plugin-git/io.kestra.plugin.git.syncflows>
- Kestra git.SyncNamespaceFiles: <https://kestra.io/plugins/plugin-git/io.kestra.plugin.git.syncnamespacefiles>
- Kestra 소스(develop, 2026-11-06 커밋 aa4bc75): `core/.../secret/SecretService.java`, `core/.../pebble/functions/SecretFunction.java`, `core/.../pebble/functions/AbstractFileFunction.java`, `core/.../configuration/LocalFilesConfiguration.java`, `core/.../plugin/core/http/Request.java`, `core/.../runners/DefaultRunContext.java`, `core/.../server/ServerConfig.java`, `webserver/.../ExecutionController.java`, `webserver/.../TriggerController.java` — <https://github.com/kestra-io/kestra>
- Kestra 서버 수명 주기: <https://kestra.io/docs/administrator-guide/server-lifecycle>
- Kestra 백필: <https://kestra.io/docs/concepts/backfill>
- DuckDB hive 파티션: <https://duckdb.org/docs/2.0/data/partitioning/hive_partitioning.html>
- Kafka Connect S3 sink: <https://docs.confluent.io/kafka-connectors/s3-sink/current/overview.html>
- Airbyte S3 목적지: <https://docs.airbyte.com/integrations/destinations/s3>
- Gerrit REST projects: <https://gerrit-review.googlesource.com/Documentation/rest-api-projects.html>
- Gerrit REST groups: <https://gerrit-review.googlesource.com/Documentation/rest-api-groups.html>
- Kestra v2.0.9 소스: `cli/.../FileChangedEventListener.java`, `core/.../flow/LoopUntil.java`, `webserver/.../TriggerController.java` — <https://github.com/kestra-io/kestra/tree/v2.0.9>
- Gerrit 소스(master): `java/com/google/gerrit/server/restapi/group/ListGroups.java`, `.../group/QueryGroups.java`, `.../project/ListProjectsImpl.java` — <https://github.com/GerritCodeReview/gerrit>
