-- 단계 사이 숫자가 맞는지 본다. ok 열이 모두 true 여야 한다.
.read pipelines/_shared/_init.sql

CREATE TEMP TABLE src_orders AS
SELECT * FROM read_csv(getvariable('source_root') || '/jaffle_shop/raw_orders.csv', header = true, all_varchar = true);
CREATE TEMP TABLE src_items AS
SELECT * FROM read_csv(getvariable('source_root') || '/jaffle_shop/raw_order_items.csv', header = true, all_varchar = true);
CREATE TEMP TABLE src_stores AS
SELECT * FROM read_csv(getvariable('source_root') || '/jaffle_shop/raw_stores.csv', header = true, all_varchar = true);

CREATE TEMP TABLE bronze_files AS
SELECT file FROM glob(getvariable('root') || '/bronze/jaffle_shop/*/dt=*/hr=*/*.csv');

CREATE TEMP TABLE silver AS
SELECT * REPLACE (snapshot_at::TIMESTAMP AS snapshot_at)
FROM read_csv(getvariable('root') || '/silver/jaffle_shop/order_lines/dt=*/hr=*/*.csv',
              header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false);
CREATE TEMP TABLE silver_last AS
SELECT * FROM silver QUALIFY snapshot_at = max(snapshot_at) OVER ();
-- 마지막 스냅샷 시각 T 까지의 원본 주문(스냅샷은 T 이전 주문만 담는다)
SET VARIABLE last_t = (SELECT max(snapshot_at) FROM silver);
CREATE TEMP TABLE src_orders_last AS
SELECT * FROM src_orders WHERE ordered_at::TIMESTAMP < getvariable('last_t');

CREATE TEMP TABLE gold_store AS
SELECT * FROM read_csv(getvariable('root') || '/gold/jaffle_shop/store_daily_sales/dt=*/*.csv', header = true, hive_partitioning = false);
CREATE TEMP TABLE gold_product AS
SELECT * FROM read_csv(getvariable('root') || '/gold/jaffle_shop/product_daily_sales/dt=*/*.csv', header = true, hive_partitioning = false);

SELECT check_name, expected, actual, expected = actual AS ok FROM (VALUES
  ('source: 주문이 기간 안에만 있음',
     0::BIGINT,
     (SELECT count(*) FROM src_orders WHERE ordered_at::TIMESTAMP <  getvariable('start_day')::TIMESTAMP
                                         OR ordered_at::TIMESTAMP >= getvariable('start_day')::TIMESTAMP + to_days(getvariable('days')))),
  ('source: 품목의 주문이 모두 있음',
     0::BIGINT,
     (SELECT count(*) FROM src_items WHERE order_id NOT IN (SELECT id FROM src_orders))),
  ('bronze: 파일 수 = (24 / 간격) × DAYS × 표 5개',
     (24 // getvariable('every_hours') * getvariable('days') * 5)::BIGINT,
     (SELECT count(*) FROM bronze_files)),
  ('silver: 스냅샷 수 = (24 / 간격) × DAYS',
     (24 // getvariable('every_hours') * getvariable('days'))::BIGINT,
     (SELECT count(DISTINCT snapshot_at) FROM silver)),
  ('silver 마지막: 품목 행 = 원본 품목(T 이전 주문)',
     (SELECT count(*) FROM src_items WHERE order_id IN (SELECT id FROM src_orders_last)),
     (SELECT count(*) FROM silver_last WHERE order_item_id IS NOT NULL)),
  ('silver 마지막: 주문 수 = 원본 주문(T 이전)',
     (SELECT count(*) FROM src_orders_last),
     (SELECT count(DISTINCT order_id) FROM silver_last)),
  ('silver 마지막: 매장 수 = 원본 매장(T 이전 개점)',
     (SELECT count(*) FROM src_stores WHERE opened_at::TIMESTAMP <= getvariable('last_t')),
     (SELECT count(DISTINCT store_id) FROM silver_last WHERE store_name IS NOT NULL)),
  ('silver 첫 스냅샷: 주문 없는 매장 행이 있음(full join)',
     1::BIGINT,
     (SELECT least(count(*), 1) FROM silver WHERE order_id IS NULL
        AND snapshot_at = (SELECT min(snapshot_at) FROM silver))),
  ('gold: 매장 매출 합 = 원본 주문 합(T 이전)',
     (SELECT sum(order_total::BIGINT) FROM src_orders_last),
     (SELECT sum(revenue_cents)::BIGINT FROM gold_store)),
  ('gold: 상품 판매 수 = silver 마지막 품목 행',
     (SELECT count(*) FROM silver_last WHERE order_item_id IS NOT NULL),
     (SELECT sum(items_sold)::BIGINT FROM gold_product))
) v(check_name, expected, actual);
