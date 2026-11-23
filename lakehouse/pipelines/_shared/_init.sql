-- 모든 파이프라인 SQL이 맨 앞에서 읽는다(작업 폴더 = lakehouse/). 값은 환경 변수로만 바꾼다(README 부록 D).
SET VARIABLE origin_root  = coalesce(nullif(getenv('SOURCE_URL'), ''),
                                     'https://dbt-tutorial-public.s3.us-west-2.amazonaws.com/long_term_dataset');  -- 자르기 전 원본
SET VARIABLE source_root  = coalesce(nullif(getenv('SOURCE_ROOT'), ''), 'source');             -- 시험용 원본
SET VARIABLE root         = coalesce(nullif(getenv('DATA_ROOT'), ''), 's3-local');    -- 로컬: s3-local(버킷 local 의 폴더), 서버: s3://local
SET VARIABLE start_day    = CAST(coalesce(nullif(getenv('START_DAY'), ''), '2019-09-12') AS DATE);
SET VARIABLE days         = CAST(coalesce(nullif(getenv('DAYS'), ''), '3') AS INTEGER);
SET VARIABLE every_hours  = CAST(coalesce(nullif(getenv('BRONZE_EVERY_HOURS'), ''), '3') AS INTEGER);  -- 브론즈 수집 간격

-- 모든 층의 CSV 읽기 옵션(ADR lakehouse/0003). 카탈로그의 읽기 macro만 부른다.
--   모든 열을 문자열로 읽고 types(열 이름 → 타입)로 바꾼다. 따옴표 없는 빈 값만 NULL. dt/hr 폴더는 열로 만들지 않는다.
CREATE MACRO lake_csv(pattern, col_types) AS TABLE
  FROM read_csv(pattern, types = col_types, header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false);
-- 위와 같고, 어느 파일에서 왔는지 filename 열을 더한다(브론즈 실행 고르기)
CREATE MACRO lake_csv_with_file(pattern, col_types) AS TABLE
  FROM read_csv(pattern, types = col_types, header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false,
                filename = true);

-- 이름 = <층>.<스키마>.<표>(ADR lakehouse/0005). 층 = catalog, 스키마 = 원천 종류, 표 = _catalog/<층>/<스키마>.sql 의 table macro.
-- DuckLake로 옮기면 이 ATTACH 줄만 바꾼다.
-- 수집 흉내용 origin, source 는 층이 아니라 파이프라인의 _sample.sql 에 둔다.
ATTACH IF NOT EXISTS ':memory:' AS bronze;
ATTACH IF NOT EXISTS ':memory:' AS silver;
ATTACH IF NOT EXISTS ':memory:' AS gold;
-- 표 이름 → 표 폴더: lake_path('silver.jaffle_shop.order_lines') = <root>/silver/jaffle_shop/order_lines
CREATE OR REPLACE MACRO lake_path(name, root := getvariable('root')) AS root || '/' || replace(name, '.', '/');
-- Airbyte 파일명 data_<epoch>_<part> 의 epoch(sync 시작 시각, ms). 인스턴스별 최신 sync를 고를 때 쓴다
CREATE OR REPLACE MACRO sync_epoch(f) AS regexp_extract(f, 'data_(\d+)_', 1);
