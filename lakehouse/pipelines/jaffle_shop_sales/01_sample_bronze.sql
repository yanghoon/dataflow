-- 로컬 전용 브론즈 샘플. 실제 수집(Airbyte, Kestra 등)이 붙기 전까지 그 결과를 대신한다.
-- 전체 수집(full sync)을 BRONZE_EVERY_HOURS(기본 3)시간마다 한 것처럼 source/ 에서 만든다. DuckDB CLI 하나로 끝난다:
--   duckdb -bail < pipelines/jaffle_shop_sales/01_sample_bronze.sql
-- DuckDB COPY 는 없는 폴더를 만들지 않으므로, 폴더 만들기(.shell mkdir -p)와 COPY 문을 build/bronze_local_sample.sql 에 쓰고 .read 로 실행한다.
-- 스냅샷 시각 T = START_DAY 00:00부터 간격마다, (24 / 간격) × DAYS개(UTC).
-- T 시점의 원본 상태: 매장은 opened_at <= T, 주문은 ordered_at < T, 품목은 그 주문의 것, 고객·상품은 전체.
-- 파일 이름 = <실행 시각 T+5분>_sim<YYYYMMDDHH> (ADR-0005 B1·B2와 같은 꼴, sim = 흉내 낸 실행 ID)
.read pipelines/_shared/_init.sql
.shell mkdir -p build

CREATE TEMP TABLE snaps AS
SELECT t,
       strftime(t, '%Y-%m-%d') AS dt,
       strftime(t, '%H')       AS hr,
       strftime(t + INTERVAL 5 MINUTE, '%Y%m%dT%H%M%SZ') || '_sim' || strftime(t, '%Y%m%d%H') AS run
FROM (SELECT getvariable('start_day')::TIMESTAMP + to_hours(h::INTEGER) AS t
      FROM range(0, 24 * getvariable('days'), getvariable('every_hours')) r(h));

CREATE TEMP TABLE tbls AS
SELECT * FROM (VALUES
  ('stores',      'raw_stores',      'opened_at::TIMESTAMP <= TIMESTAMP ''{T}'''),
  ('customers',   'raw_customers',   'true'),
  ('products',    'raw_products',    'true'),
  ('orders',      'raw_orders',      'ordered_at::TIMESTAMP < TIMESTAMP ''{T}'''),
  ('order_items', 'raw_order_items', 'order_id IN (SELECT id FROM read_csv(''{SRC}/raw_orders.csv'', header = true, all_varchar = true) WHERE ordered_at::TIMESTAMP < TIMESTAMP ''{T}'')')
) v(tbl, src_file, cond);

CREATE TEMP TABLE plan AS
SELECT s.*, b.tbl, b.src_file,
       getvariable('root') || '/bronze/jaffle_shop/' || b.tbl || '/dt=' || s.dt || '/hr=' || s.hr AS dir,
       replace(replace(b.cond, '{T}', strftime(s.t, '%Y-%m-%d %H:%M:%S')),
               '{SRC}', getvariable('source_root') || '/jaffle_shop') AS cond_sql
FROM snaps s CROSS JOIN tbls b;

.mode list
.headers off
.once build/bronze_local_sample.sql
SELECT line FROM (
  SELECT DISTINCT dir, 0 AS ord, '.shell mkdir -p ' || dir AS line FROM plan
  UNION ALL
  SELECT dir, 1, 'COPY (SELECT * FROM read_csv(''' || getvariable('source_root') || '/jaffle_shop/' || src_file
         || '.csv'', header = true, all_varchar = true) WHERE ' || cond_sql || ') TO '''
         || dir || '/' || run || '.csv'' (FORMAT csv, HEADER true);'
  FROM plan
) ORDER BY dir, ord;
.read build/bronze_local_sample.sql
.mode duckbox
.headers on
SELECT count(DISTINCT run) AS snapshots, count(*) AS files, min(t) AS first_snapshot, max(t) AS last_snapshot FROM plan;
