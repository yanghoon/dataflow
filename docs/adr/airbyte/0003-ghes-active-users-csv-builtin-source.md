# GHES Active Users CSV는 커스텀 코드 없이 Airbyte Connector Builder로 수집한다

GHES `active_users.csv` 리포트(생성에 약 10분)를 S3로 적재하는 Airbyte 소스를 커스텀 코드 없이 Connector Builder 매니페스트로 구성한다.
생성 중 응답(`202`)을 상태코드 기준으로 재시도하고 `CsvDecoder`로 파싱한다. 미완료 신호가 `202`라는 가정은 **검증 전 임시값**으로 그대로 사용하고, 아래 검증 항목으로 추적한다.

## Status

Accepted (임시 가정 기반. 구현은 별도 승인 후, 검증 항목 확인 필요)

## Context

- 엔드포인트: `GET /stafftools/reports/active_users.csv`, `site_admin` 스코프 PAT 인증.
- 생성 중 응답에 대해 문서와 사용자 관찰이 다르다.
  - GHES 문서(3.7)와 커뮤니티 스크립트: 캐시가 없으면 `202`를 반환하고 백그라운드 생성. 클라이언트가 대기 후 재요청.
  - 사용자 관찰: `200 OK` + 본문 0바이트. 원인(리다이렉트, 프록시, 버전)은 미확인.
- 생성 시간은 고정이 아니며 약 10분.
- 결과는 원본과 내용이 같은 CSV면 된다. 바이트 동일성은 불필요(사용자 확인).

### 임시 가정 (검색 자료 기준, 아래 검증 항목으로 확인 후 수정)

| 항목 | 임시 값 |
|---|---|
| 미완료 신호 | `202` (문서). `200` + 빈 본문은 미확정 |
| 인증 | `Authorization: Bearer <PAT>` |
| 최대 대기 | 기본 10분, 설정 가능 |
| 재시도 간격 | 설정 가능 |

## Decision

일반 스트림(SimpleRetriever)에 다음을 구성한다.

- `DefaultErrorHandler` + `HttpResponseFilter(action: RETRY, http_codes: [202])`.
- `max_retries`와 `ConstantBackoffStrategy`의 대기 시간은 `config` 보간으로 사용자 설정. 대기 × 횟수가 최대 대기 시간이다(기본 10분 = 30초 × 20회).
- `CsvDecoder`는 retriever와 record extractor 양쪽에 지정한다.
- 계속 `202`이면 재시도 소진 후 sync 실패. 빈 결과가 성공으로 적재되지 않는다.
- S3 목적지 포맷은 CSV, 스키마는 전 컬럼 문자열로 둔다(검증 필요).

## 검토 결과

- **`CsvDecoder`는 retriever와 extractor 둘 다 필요하다.** 한쪽만 지정하면 0건이 된다.
- **본문 기반 predicate는 `CsvDecoder`와 충돌한다.** `Content-Length == 0` 같은 predicate를 붙이면 첫 요청이 성공해도 0건이 된다. 원인은 미확인이다. 그래서 상태코드(`http_codes`)로 재시도한다.
- **`200` + 빈 본문은 감지하지 못한다.** 이 경우 0건 성공으로 처리된다.
- **대기 시간은 지정값보다 길게 적용될 수 있다.** 1초 지정이 2초로 로그에 찍혔다. 하한 여부는 미확인이다.
- **Builder UI의 Test 버튼은 재시도하지 않는다**(공식 문서). 재시도는 실제 sync로 확인한다.

## Considered Options

| 옵션 | 결과 |
|---|---|
| AsyncRetriever(비동기 스트림) | 기각. 상태를 JSON 필드로만 판정하는데 GHES는 JSON 상태가 없다. 폴링 간격 설정도 없고 `polling_job_timeout`(분)만 있다. |
| Copy Raw Files(원문 파일 전송) | 기각. S3·SFTP Bulk 등 파일 기반 소스만 지원하며 HTTP·Builder 커넥터는 대상이 아니다. |
| `Content-Length == 0` predicate 재시도 | 기각. `CsvDecoder`와 충돌. |
| 에러 핸들러 없음 | 기각. 빈 응답이 0건 성공이 되고 대기가 없다. |
| 커스텀 Python CDK (ADR-0001 선례) | 보류. `200` 빈 본문이 실제로 확인되면 재검토. 최소 구성에서 벗어나고 이미지 빌드·배포 부담이 있다. |

## Consequences

- CSV는 Airbyte에서 한 번 파싱되어 레코드가 된다. 출력 CSV는 컬럼 순서, 인용부호, 줄바꿈, BOM이 원본과 다를 수 있다. 하류에 알려야 한다.
- V1에서 `200` + 빈 본문으로 확인되면 이 결정은 성립하지 않는다. 그 경우 커스텀 CDK 또는 하류 검증(적재 결과의 레코드 0건 감지)이 필요하다.

## 검증 항목

임시 가정을 그대로 사용하므로 구현 전후에 다음을 확인한다. 결과에 따라 이 ADR을 갱신한다.

| # | 항목 | 확인 방법 | 어긋나면 |
|---|---|---|---|
| V1 | 생성 중 응답이 `202`인가 (사용자는 `200` + 빈 본문을 관찰) | GHES에 `curl -sS -D - -o /dev/null`로 첫 호출과 직후 호출, `--location` 유무 비교 | `200` 빈 본문이면 본 결정 불성립. 커스텀 CDK 또는 하류 검증으로 재결정 |
| V2 | 완료 응답이 `200` + CSV 본문인가, 헤더(`Content-Type` 등) | V1과 동일 | 매니페스트 디코더·재시도 조건 수정 |
| V3 | 배포된 Airbyte의 Builder 버전에서 재시도 + `CsvDecoder`가 동작하는가 | 실제 sync (Test 버튼은 재시도 안 함) | 버전 차이 반영해 구성 수정 |
| V4 | 재시도 대기 시간이 지정값대로 적용되는가 (로컬에서 1초 지정이 2초로 로그됨) | 실제 sync 로그 | 기본값(30초 × 20회) 조정 |
| V5 | 인증 방식이 Bearer PAT로 통하는가 | V1 호출 | 인증 설정 수정 |
| V6 | S3 CSV 출력이 원본과 내용이 같은가 (컬럼, 인용부호, 줄바꿈, BOM, 빈 값) | 원본과 diff | 스키마·포맷 조정 또는 하류에 차이 고지 |

## Sources

- [GHES 3.18: Accessing reports for your instance](https://docs.github.com/en/enterprise-server@3.18/admin/monitoring-activity-in-your-enterprise/exploring-user-activity-in-your-enterprise/accessing-reports-for-your-instance)
- [GHES 3.7: site admin dashboard (202 동작)](https://docs.github.com/en/enterprise-server@3.7/admin/configuration/site-admin-dashboard)
- [Site Admin 리포트 다운로드 스크립트 (gist)](https://gist.github.com/jdennes/49d2fd3b77668a4c078df3127700da97)
- [Airbyte async streams](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/async-streams)
- [Airbyte Builder error handling](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/error-handling)
- [Airbyte delivery methods](https://docs.airbyte.com/platform/using-airbyte/delivery-methods)
- airbyte-python-cdk `declarative_component_schema.yaml`, `http_job_repository.py`
