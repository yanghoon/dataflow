-- origin.raw_*(전체 6년치) → source.raw_*(START_DAY부터 DAYS일)
-- DuckDB가 원본 주소에서 흘려 읽으며 자른다. 원본 전체(약 550MB)를 받지만 디스크에는 잘린 결과만 남는다.
-- 원본 형식(열 이름, 값 표기)을 바꾸지 않는다. 모든 열을 문자열로 읽고 그대로 쓴다.
.read pipelines/_shared/_init.sql
.read pipelines/jaffle_shop_sales/_sample.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   origin  읽기  origin_raw_<표>()       자르기 전 원본 5개 표(stores, orders, order_items, customers, products)
--   source  쓰기  source_raw_<표>_path()  기간만큼 자른 시험용 원본 5개 표
INSTALL httpfs;
LOAD httpfs;

-- 주문: 기간 안의 것만
CREATE TEMP TABLE raw_orders AS
FROM origin_raw_orders()
WHERE ordered_at::TIMESTAMP >= getvariable('start_day')::TIMESTAMP
  AND ordered_at::TIMESTAMP <  getvariable('start_day')::TIMESTAMP + to_days(getvariable('days'));

-- 품목: 잘라낸 주문에 딸린 것만
CREATE TEMP TABLE raw_order_items AS
FROM origin_raw_order_items() WHERE order_id IN (SELECT id FROM raw_orders);

-- 매장: 기간이 끝나기 전에 연 매장(기간 중에 여는 매장도 포함)
CREATE TEMP TABLE raw_stores AS
FROM origin_raw_stores()
WHERE opened_at::TIMESTAMP < getvariable('start_day')::TIMESTAMP + to_days(getvariable('days'));

-- 고객, 상품: 시각 열이 없어 전체
CREATE TEMP TABLE raw_customers AS FROM origin_raw_customers();  -- 고객 전체
CREATE TEMP TABLE raw_products  AS FROM origin_raw_products();   -- 상품 전체

COPY raw_orders      TO (source_raw_orders_path())      (FORMAT csv, HEADER true);
COPY raw_order_items TO (source_raw_order_items_path()) (FORMAT csv, HEADER true);
COPY raw_stores      TO (source_raw_stores_path())      (FORMAT csv, HEADER true);
COPY raw_customers   TO (source_raw_customers_path())   (FORMAT csv, HEADER true);
COPY raw_products    TO (source_raw_products_path())    (FORMAT csv, HEADER true);

SELECT * FROM (VALUES
  ('source.raw_orders',      (SELECT count(*) FROM raw_orders)),
  ('source.raw_order_items', (SELECT count(*) FROM raw_order_items)),
  ('source.raw_stores',      (SELECT count(*) FROM raw_stores)),
  ('source.raw_customers',   (SELECT count(*) FROM raw_customers)),
  ('source.raw_products',    (SELECT count(*) FROM raw_products))
) v(written, rows);
