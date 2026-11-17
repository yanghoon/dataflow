-- 원본 주소의 raw_*.csv(전체 6년치) → source/jaffle_shop/raw_*.csv(START_DAY부터 DAYS일)
-- DuckDB가 주소에서 흘려 읽으며 자른다. 원본 전체(약 550MB)를 받지만 디스크에는 잘린 결과만 남는다.
-- 원본 형식(열 이름, 값 표기)을 바꾸지 않는다. 모든 열을 문자열로 읽고 그대로 쓴다.
.read pipelines/_shared/_init.sql
INSTALL httpfs;
LOAD httpfs;

SET VARIABLE src = coalesce(nullif(getenv('SOURCE_URL'), ''),
                            'https://dbt-tutorial-public.s3.us-west-2.amazonaws.com/long_term_dataset');

CREATE TEMP TABLE orders AS
SELECT * FROM read_csv(getvariable('src') || '/raw_orders.csv', header = true, all_varchar = true)
WHERE ordered_at::TIMESTAMP >= getvariable('start_day')::TIMESTAMP
  AND ordered_at::TIMESTAMP <  getvariable('start_day')::TIMESTAMP + to_days(getvariable('days'));

COPY orders TO (getvariable('source_root') || '/jaffle_shop/raw_orders.csv') (FORMAT csv, HEADER true);

-- 품목: 잘라낸 주문에 딸린 것만
COPY (
  SELECT i.* FROM read_csv(getvariable('src') || '/raw_order_items.csv', header = true, all_varchar = true) i
  WHERE i.order_id IN (SELECT id FROM orders)
) TO (getvariable('source_root') || '/jaffle_shop/raw_order_items.csv') (FORMAT csv, HEADER true);

-- 매장: 기간이 끝나기 전에 연 매장(기간 중에 여는 매장도 포함)
COPY (
  SELECT * FROM read_csv(getvariable('src') || '/raw_stores.csv', header = true, all_varchar = true)
  WHERE opened_at::TIMESTAMP < getvariable('start_day')::TIMESTAMP + to_days(getvariable('days'))
) TO (getvariable('source_root') || '/jaffle_shop/raw_stores.csv') (FORMAT csv, HEADER true);

-- 고객, 상품: 시각 열이 없어 전체
COPY (SELECT * FROM read_csv(getvariable('src') || '/raw_customers.csv', header = true, all_varchar = true))
  TO (getvariable('source_root') || '/jaffle_shop/raw_customers.csv') (FORMAT csv, HEADER true);
COPY (SELECT * FROM read_csv(getvariable('src') || '/raw_products.csv', header = true, all_varchar = true))
  TO (getvariable('source_root') || '/jaffle_shop/raw_products.csv') (FORMAT csv, HEADER true);

SELECT count(*) AS orders, min(ordered_at) AS first_order, max(ordered_at) AS last_order FROM orders;
