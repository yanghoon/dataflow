---
status: accepted
date: 2026-11-17
---

# 파이프라인 SQL의 파일 위치와 타입은 카탈로그 macro에 두고, 본문은 이름으로만 읽고 쓴다

파이프라인 SQL은 문장마다 `read_csv(getvariable('root') || '경로', 옵션 …)`와 타입 변환을 직접 적었다. 같은 내용이 파일마다 반복되고 핵심 로직이 묻혔다. 그래서 파이프라인마다 `_catalog.sql` 하나에 위치, 읽기 옵션, 타입 변환을 macro로 선언한다. 본문은 `FROM 이름`으로 읽고 업무 규칙과 집계만 담는다. 나중에 dbt로 옮길 때 구조가 그대로 이어지게 하는 것이 목표다.

## 결정

1. **카탈로그**: 파이프라인마다 `pipelines/<파이프라인>/_catalog.sql` 하나. 본문은 맨 위에서 `_shared/_init.sql`과 이 파일을 `.read`로 읽는다.
2. **읽기**: 테이블마다 table macro 하나, 이름은 `{계층}_{테이블}()`(예: `bronze_orders()`, `silver_order_lines()`). 위치, 파일 패턴, 읽기 옵션, 타입 변환만 담는다. 위치 인자(`root := getvariable('root')`)를 기본값과 함께 받는다. DuckDB 2.0은 인자 없는 macro와 뷰를 만들 때 파일을 읽어서, 아직 없는 출력을 선언하면 실패한다. 인자가 있으면 호출할 때 읽는다. 파일 경로가 필요한 곳(브론즈)은 `filename` 열도 돌려준다.
3. **쓰기**: 테이블마다 scalar macro 하나, 이름은 `{계층}_{테이블}_path()`. `COPY TO`는 경로만 받으므로 `TO (gold_product_daily_sales_path())`로 쓴다. 브론즈만 `bronze_jaffle_shop_path(tbl)`로 표 이름을 받는다. 수집기가 모든 표에 같은 규칙으로 쓰기 때문이다.
4. **함께 쓰는 규칙**: 여러 파일이 같은 기준을 써야 하는 규칙은 카탈로그에 따로 둔다. 예: "가장 늦은 실버 스냅샷만 쓴다"는 30, 31, 90이 쓰므로 `silver_order_lines_latest()`로 둔다.
5. **본문에 남는 것**: 그 파일만 쓰는 규칙(예: 20번의 스냅샷마다 실행 하나 고르기), 집계, `COPY` 출력 옵션.
6. **범위**: `jaffle_shop_sales`의 모든 SQL(00~90). 원본, source, 브론즈, 실버, 골드 위치를 모두 카탈로그로 옮긴다. 환경 변수를 읽는 곳은 `_init.sql` 하나다(원본 주소 `origin_root`도 여기로 옮겼다).
7. **실행 로그**: 각 단계는 결과를 출력 이름의 임시 테이블로 만들고, `COPY`로 쓴 뒤, 한 줄 통계(`written`, `rows`, `partitions`)만 출력한다. 결과 검증은 `90_checks.sql`만 한다. `COPY`의 `RETURN_STATS`는 CSV에서 지원하지 않고, `RETURN_FILES`는 파일 목록이 길어 쓰지 않는다.
8. **로컬과 S3**: SQL은 같고 실행 명령만 다르다. `DATA_ROOT`를 바꾸고, S3면 `_init_s3.sql`을 붙인다.
9. **S3 설정**: `_shared/_s3.sql`을 `_shared/_init_s3.sql`로 바꾼다. 값은 환경 변수로만 받는다. `CREATE SECRET` 안에는 `coalesce` 같은 식을 쓸 수 없으므로 기본값은 변수로 먼저 정한다. S3가 더 생기면 `_init_s3_<이름>.sql`을 더하고, 파일마다 비밀 이름, `SCOPE 's3://<버킷>'`, 환경 변수 접두사를 다르게 한다.

```sql
-- _catalog.sql
CREATE MACRO silver_order_lines_path(root := getvariable('root')) AS root || '/silver/jaffle_shop/order_lines';
CREATE MACRO silver_order_lines(root := getvariable('root')) AS TABLE
  SELECT * REPLACE (snapshot_at::TIMESTAMP AS snapshot_at, ordered_at::TIMESTAMP AS ordered_at, …)
  FROM read_csv(silver_order_lines_path(root := root) || '/dt=*/hr=*/*.csv',
                header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false);
CREATE MACRO silver_order_lines_latest(root := getvariable('root')) AS TABLE
  FROM silver_order_lines(root := root) QUALIFY snapshot_at = max(snapshot_at) OVER ();

-- 31_gold_product_daily_sales.sql
.read pipelines/_shared/_init.sql
.read pipelines/jaffle_shop_sales/_catalog.sql

CREATE TEMP TABLE product_daily_sales AS
SELECT … FROM silver_order_lines_latest() WHERE order_item_id IS NOT NULL GROUP BY ALL;

COPY product_daily_sales TO (gold_product_daily_sales_path())
  (FORMAT csv, HEADER true, PARTITION_BY (dt), OVERWRITE_OR_IGNORE true);

SELECT 'gold.product_daily_sales' AS written, count(*) AS rows, count(DISTINCT dt) AS partitions FROM product_daily_sales;
```

```bash
duckdb -bail < $P/31_gold_product_daily_sales.sql                       # 로컬
DATA_ROOT=s3://local duckdb -bail -cmd ".read pipelines/_shared/_init_s3.sql" \
  < $P/31_gold_product_daily_sales.sql                                    # S3
```

## Considered Options

- **지금처럼 직접 적기**: 경로, 옵션, 타입 변환이 반복되고 로직이 묻힌다.
- **뷰, 인자 없는 macro**: 괄호나 인자가 없어 더 자연스럽지만, 만들 때 파일을 읽으므로 아직 없는 출력을 선언할 수 없다(DuckDB 2.0에서 확인).
- **경로만 변수로**: 읽기 옵션과 타입 변환은 계속 반복된다.
- **인자로 테이블을 고르는 읽기 macro 하나**: dbt의 source 테이블 단위와 맞지 않는다.
- **타입 변환이나 스냅샷 고르기를 본문에 두기**: 같은 줄이 여러 파일에 반복되고, 하나를 빠뜨리면 파일끼리 숫자가 어긋난다.
- **저장소마다 카탈로그(`_catalog-s3.sql`)**: 위치는 `DATA_ROOT`로 이미 바뀐다. 저장 방식(Parquet, DuckLake)이 바뀌면 쓰기 문장도 바뀌므로 카탈로그 교환으로는 안 된다. 그때는 별도 폴더나 dbt 프로젝트로 전체를 옮긴다.
- **S3 설정을 `_init.sql`에 합치기**: SQL에 조건문이 없어 로컬에서도 httpfs를 내려받아야 하고, 인터넷이 막힌 곳에서 멈춘다.
- **Parquet, DuckLake, 지금 dbt 도입**: 저장 방식이나 도구가 바뀌어 이번 범위를 넘는다.

## Consequences

- 본문을 이해하려면 카탈로그를 함께 봐야 한다. 대신 위치와 타입은 한 곳에만 있다.
- 읽기 macro를 부를 때 다른 위치를 줄 수 있다(`FROM silver_order_lines(root := 's3://other')`).
- 2026-11-17 DuckDB 2.0.0으로 확인했다.
  - 로컬: 바꾸기 전과 후의 결과를 비교했다. source 4개 파일, 브론즈, 실버는 바이트까지 같다. 골드와 `raw_order_items`는 내용이 같고 행 순서만 다르다. 행 순서는 바꾸기 전 코드도 실행할 때마다 달라진다. 검증 10개가 모두 통과했다.
  - S3: 임시 versitygw(posix, `--nometa`)에서 20~90을 두 번 연속 실행했다. 덮어쓰기, `glob`과 파일 패턴, 20번의 경로 정규식이 모두 동작했고, 결과가 로컬과 같았다.
  - Kestra 호출은 아직 확인하지 않았다.
- 결과 파일을 비교할 때는 행을 정렬한 뒤 비교한다. `GROUP BY` 결과의 순서는 정해져 있지 않다.
- dbt로 옮기면 아래처럼 대응한다. 본문 로직은 거의 그대로다.

| 지금 | dbt-duckdb |
|---|---|
| 카탈로그의 위치와 읽기 macro | `sources.yml`의 `external_location` |
| 읽기 macro의 타입 변환 | staging 모델 |
| 함께 쓰는 규칙 macro, 20번의 실행 고르기 | intermediate 모델 |
| `FROM silver_order_lines_latest()` | `FROM {{ ref('int_order_lines_latest') }}` |
| 출력 이름의 임시 테이블과 `COPY … TO (…_path())` | `materialized='external'`, `location`. 본문은 `SELECT`만 남는다 |
| 본문 맨 위 `.read` 두 줄, 통계 `SELECT` | 지운다(dbt가 실행 로그를 남긴다) |
| 파일 번호 순서 | `ref()`로 정해지는 순서 |
| 90의 검증 | `schema.yml`의 테스트 |
| `_init.sql`, `_init_s3.sql`, 실행 명령 | `profiles.yml`의 settings, secrets, target |
