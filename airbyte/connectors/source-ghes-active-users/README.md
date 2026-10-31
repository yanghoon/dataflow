# source-ghes-active-users

GHES `active_users.csv` 리포트를 수집하는 Airbyte Connector Builder 매니페스트. 커스텀 코드 없음.
설계 근거와 검증 항목(V1~V6): `docs/adr/airbyte/0003-ghes-active-users-csv-builtin-source.md`

## 사용

### 방법 1. 파일 Import

Builder UI에서 `manifest.yaml`을 Import한다.

### 방법 2. YAML 편집기에 붙여넣기

Builder에서 새 커넥터를 만들고 UI/YAML 전환으로 YAML 편집기를 연 뒤, `manifest.yaml` 전체를 붙여넣는다. UI에 없는 필드가 있으면 YAML 모드로 열린다. 전환 컨트롤의 정확한 이름은 Airbyte 버전마다 다를 수 있다.

### 설정

`host`, `api_token`(site_admin PAT), `max_retries`(기본 20), `retry_interval_seconds`(기본 30).

## 주의

- 생성 중 응답을 `202`로 가정한다(검증 전). `200` + 빈 본문이면 0건 성공으로 처리된다.
- Builder의 Test 버튼은 재시도하지 않는다. 실제 sync로 확인한다.
- 스키마는 컬럼 미정의(`additionalProperties: true`). 전 컬럼 문자열로 적재된다.
