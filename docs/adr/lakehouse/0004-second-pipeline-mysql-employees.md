---
status: accepted
date: 2026-11-17
---

# 두 번째 파이프라인(MySQL employees)은 공통 파일을 고치지 않고 붙이고, 파이프라인 전용 값과 DB 연결은 파이프라인 폴더에 둔다

`jaffle_shop_sales`만 있을 때 정한 공통 파일(`_shared/_init.sql`, `_init_s3.sql`)과 카탈로그 규칙(ADR 0002, 0003)이 파이프라인이 늘어도 버티는지 보려고, 성격이 다른 원천(MySQL `employees`, 하루 스냅샷, 브론즈 1개)을 `pipelines/employees_dept_payroll/`로 더했다. 공통 파일과 jaffle 파일은 고치지 않았고, 시험에서 나온 규칙만 `lakehouse/AGENTS.md`에 반영했다. 그 결과 공통 CSV 읽기와 경로 변수는 그대로 쓸 수 있었고, 맞지 않는 부분은 아래처럼 파이프라인 폴더 안에서 풀었다.

## 결정

1. **파이프라인 전용 값**: `pipelines/<파이프라인>/_init.sql`에 두고 `_shared/_init.sql` 바로 다음에 읽는다. 환경 변수는 파이프라인 접두사를 붙인다(`EMP_AS_OF_DAY`). AGENTS.md의 환경 변수 규칙을 공통(`_shared/_init.sql`), 파이프라인 전용(`<파이프라인>/_init.sql`), 원천 접속(`_catalog/origin.sql`) 세 곳으로 고쳤다.
2. **DB 원천**: 연결(`INSTALL mysql`, `TEMPORARY SECRET`, `ATTACH … READ_ONLY`)과 원천 표 macro를 `_catalog/origin.sql`에 둔다. 00번만 읽는다. 다른 단계와 90번은 MySQL 없이 돈다. 접속 값은 환경 변수로만 받는다.
3. **원천 MySQL**: compose 파일이나 스크립트를 두지 않고, 파이프라인 README 2장의 `docker run`/`docker exec` 명령으로 띄우기 → 컨테이너 안에서 test_db 내려받아 적재 → 읽기 계정 → 00번 → 멈추기를 한다. DB 데이터와 내려받은 파일은 컨테이너 tmpfs에만 있어 로컬에는 `source/`의 CSV만 남는다. 비밀번호는 셸에서 실행마다 만들어 환경 변수로만 넘기므로 `.env`가 없다. 00번은 SELECT만 되는 계정으로 읽는다.
4. **카탈로그 이름**: 표 이름(`employees`)이 스키마 이름과 같으면 스키마 단위 macro(`bronze_<스키마>_path`)가 표 macro(`bronze_<표>_path`)와 겹친다. 그래서 쓰기 경로를 표마다 두고, 파일 목록 macro만 `bronze_<스키마>_db_files()`로 둔다.
5. **데이터 폴더**: 층 폴더 아래 스키마 이름(`employees`)으로 나눈다. 스키마 이름은 파이프라인마다 달라야 한다.

## Considered Options

- **`_shared/_init.sql`에 EMP 값 더하기**: 파이프라인마다 공통 파일이 커지고, 모든 파이프라인이 남의 값을 읽는다. 지금도 jaffle 값(`origin_root`, `start_day`, `days`, `every_hours`)이 그렇다.
- **jaffle 값을 `jaffle_shop_sales/_init.sql`로 옮기기**: 바른 방향이지만 jaffle 파일과 README를 고쳐야 해 이번 범위에서 뺐다(후속 1).
- **원천 연결을 `_catalog/source.sql`에 두기**: 90번까지 MySQL이 필요해진다.
- **브론즈 샘플 만들기와 실행 고르기(B4)를 `_shared`의 macro로 만들기**: 두 파이프라인이 같은 꼴을 복사했다. 다만 DuckDB CLI의 `.shell`, `.once`는 macro로 감쌀 수 없고, 실행 고르기는 표 개수와 스키마만 달라 지금은 복사가 더 읽기 쉽다(후속 2).
- **MySQL 덤프를 DuckDB로 직접 읽기**: 덤프는 `INSERT` 문이라 CSV처럼 읽을 수 없고, 원천을 DB로 두는 시험 목적에 맞지 않는다.

## Consequences

- 2026-11-17 로컬에서 00~90을 실행해 검증 8개가 모두 통과했다(2000-01-01, 직원 257,293명, 부서 9개, 급여 합 17,133,967,926). 같은 때 jaffle 20~90도 다시 돌려 검증 10개가 통과했다. 00번 출력과 `build/` 파일에 비밀번호가 남지 않음을 확인했다. S3와 Kestra 호출은 실행하지 않았다.
- 크기: source 38MB, 브론즈 38MB, 실버 34MB, 골드 4KB. MySQL 컨테이너 메모리 약 500MiB(tmpfs 포함). 띄우기부터 00번까지 약 70초(내려받기 포함, 매번 다시 받는다).
- 처음에는 `build/test_db`에 clone(약 215MB)하고 compose 파일과 이름 있는 볼륨을 썼다. 로컬에 남는 것이 없고 파이프라인 폴더에 SQL과 README만 있도록 위 3처럼 바꿨다(같은 날).
- macro 이름에 파이프라인 구분이 없다. 실행마다 한 파이프라인의 카탈로그만 읽는 동안은 문제가 없지만, 두 파이프라인을 한 세션에서 읽는 단계(예: 파이프라인을 가로지르는 골드)가 생기면 이름 규칙을 다시 정해야 한다.
- 후속(아직 하지 않음):
  1. jaffle 전용 값을 `jaffle_shop_sales/_init.sql`로 옮기고 `_shared/_init.sql`에는 `root`, `source_root`, `lake_csv`만 남긴다. (AGENTS.md 규칙은 이미 고쳤다.)
  2. 세 번째 파이프라인이 생기면 브론즈 샘플 만들기와 실행 고르기를 공통으로 뺄지 다시 본다.
  3. jaffle의 스키마 단위 쓰기 경로(`bronze_jaffle_shop_path(tbl)`)를 표마다로 바꿀지 정한다. 규칙이 두 가지로 갈라져 있다.
