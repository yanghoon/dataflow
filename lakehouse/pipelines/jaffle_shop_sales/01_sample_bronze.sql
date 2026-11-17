-- 로컬 전용 브론즈 샘플. 실제 수집(Airbyte, Kestra 등)이 붙기 전까지 그 결과를 대신한다.
-- 전체 수집(full sync)을 BRONZE_EVERY_HOURS(기본 3)시간마다 한 것처럼 source 에서 만든다. DuckDB CLI 하나로 끝난다:
--   duckdb -bail < pipelines/jaffle_shop_sales/01_sample_bronze.sql
-- DuckDB COPY 는 없는 폴더를 만들지 않으므로, 폴더 만들기(.shell mkdir -p)와 COPY 문을 build/bronze_local_sample.sql 에 쓰고 .read 로 실행한다.
-- 스냅샷 시각 T = START_DAY 00:00부터 간격마다, (24 / 간격) × DAYS개(UTC).
-- T 시점의 원본 상태: 매장은 opened_at <= T, 주문은 ordered_at < T, 품목은 그 주문의 것, 고객·상품은 전체.
-- 파일 이름 = <실행 시각 T+5분>_sim<YYYYMMDDHH> (ADR-0005 B1·B2와 같은 꼴, sim = 흉내 낸 실행 ID)
.read pipelines/_shared/_init.sql
.read pipelines/jaffle_shop_sales/_catalog_source.sql
.read pipelines/jaffle_shop_sales/_catalog_bronze.sql
.shell mkdir -p build

CREATE TEMP TABLE snaps AS
SELECT t,
       strftime(t, '%Y-%m-%d') AS dt,
       strftime(t, '%H')       AS hr,
       strftime(t + INTERVAL 5 MINUTE, '%Y%m%dT%H%M%SZ') || '_sim' || strftime(t, '%Y%m%d%H') AS run
FROM (SELECT getvariable('start_day')::TIMESTAMP + to_hours(h::INTEGER) AS t
      FROM range(0, 24 * getvariable('days'), getvariable('every_hours')) r(h));

-- 표마다 T 시점의 행을 고르는 조건. 원본은 source_raw_<표>() 로 읽는다.
CREATE TEMP TABLE tbls AS
SELECT * FROM (VALUES
  ('stores',      'opened_at::TIMESTAMP <= TIMESTAMP ''{T}'''),
  ('customers',   'true'),
  ('products',    'true'),
  ('orders',      'ordered_at::TIMESTAMP < TIMESTAMP ''{T}'''),
  ('order_items', 'order_id IN (SELECT id FROM source_raw_orders() WHERE ordered_at::TIMESTAMP < TIMESTAMP ''{T}'')')
) v(tbl, cond);

CREATE TEMP TABLE plan AS
SELECT s.*, b.tbl,
       bronze_jaffle_shop_path(b.tbl) || '/dt=' || s.dt || '/hr=' || s.hr AS dir,
       replace(b.cond, '{T}', strftime(s.t, '%Y-%m-%d %H:%M:%S'))         AS cond_sql
FROM snaps s CROSS JOIN tbls b;

.mode list
.headers off
.once build/bronze_local_sample.sql
SELECT line FROM (
  SELECT DISTINCT dir, 0 AS ord, '.shell mkdir -p ' || dir AS line FROM plan
  UNION ALL
  SELECT dir, 1, 'COPY (FROM source_raw_' || tbl || '() WHERE ' || cond_sql || ') TO '''
         || dir || '/' || run || '.csv'' (FORMAT csv, HEADER true);'
  FROM plan
) ORDER BY dir, ord;
.read build/bronze_local_sample.sql
.mode duckbox
.headers on
SELECT 'bronze.jaffle_shop' AS written, count(*) AS files, count(DISTINCT run) AS snapshots,
       min(t) AS first_snapshot, max(t) AS last_snapshot
FROM plan;
