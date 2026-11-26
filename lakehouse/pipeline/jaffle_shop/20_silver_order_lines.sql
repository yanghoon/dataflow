-- bronze.jaffle_shop 5개 표 → silver.jaffle_shop.order_lines(dt, hr = 스냅샷)
-- 스냅샷(dt/hr)마다 표 5개가 모두 있는 실행 중 파일명이 가장 늦은 것 하나를 고르고(ADR-0005 B4),
-- 그 실행의 매장 ⟗ 주문 ⟗ 품목을 full join 한다. 고객·상품은 붙이기만 한다(left join).
-- 한 행 = 주문 품목 하나. 주문이 없는 매장도 한 행으로 남는다(주문 열은 NULL).
.read pipeline/_init/base.sql
.read pipeline/_catalog/jaffle_shop/bronze.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   bronze  읽기  bronze.jaffle_shop.files()  브론즈 파일 목록(실행 고르기)
--   bronze  읽기  bronze.jaffle_shop.<표>()                5개 표(stores, customers, products, orders, order_items)
--   silver  쓰기  lake_path('silver.jaffle_shop.order_lines')   주문 품목 한 행, 스냅샷(dt, hr)별

-- 브론즈 파일 하나 = 한 행. 경로에서 표, dt, hr, 실행 이름을 뽑는다
CREATE TEMP TABLE files AS
SELECT file,
       regexp_extract(file, '/bronze/jaffle_shop/([a-z_]+)/dt=', 1)                 AS tbl,
       regexp_extract(file, '/dt=([0-9]{4}-[0-9]{2}-[0-9]{2})/', 1)                   AS dt,
       regexp_extract(file, '/hr=([0-9]{2})/', 1)                                     AS hr,
       regexp_extract(file, '/([0-9]{8}T[0-9]{6}Z_[0-9A-Za-z]+)\.csv$', 1)            AS run
FROM bronze.jaffle_shop.files();

-- 스냅샷(dt, hr)마다 고른 실행 하나
CREATE TEMP TABLE picked AS
SELECT dt, hr, run
FROM files
GROUP BY dt, hr, run
HAVING count(DISTINCT tbl) = 5
QUALIFY row_number() OVER (PARTITION BY dt, hr ORDER BY run DESC) = 1;

-- 표마다 고른 실행의 행만 남긴다(run 열을 붙인다). 브론즈는 모든 열이 문자열이고, 아래 SELECT 에서 타입을 바꾼다.
CREATE TEMP TABLE stores AS  -- 고른 실행의 매장
SELECT p.run, b.* EXCLUDE (filename) FROM bronze.jaffle_shop.stores() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE customers AS  -- 고른 실행의 고객
SELECT p.run, b.* EXCLUDE (filename) FROM bronze.jaffle_shop.customers() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE products AS  -- 고른 실행의 상품
SELECT p.run, b.* EXCLUDE (filename) FROM bronze.jaffle_shop.products() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE orders AS  -- 고른 실행의 주문
SELECT p.run, b.* EXCLUDE (filename) FROM bronze.jaffle_shop.orders() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE order_items AS  -- 고른 실행의 주문 품목
SELECT p.run, b.* EXCLUDE (filename) FROM bronze.jaffle_shop.order_items() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';

-- 같은 실행 안에서 매장 ⟗ 주문 ⟗ 품목, 고객·상품을 붙이고 타입을 정한다
CREATE TEMP TABLE joined AS
SELECT coalesce(i.run, o.run, s.run)       AS run,
       coalesce(s.id, o.store_id)          AS store_id,
       s.name                              AS store_name,
       s.opened_at::TIMESTAMP              AS store_opened_at,
       s.tax_rate::DOUBLE                  AS store_tax_rate,
       coalesce(o.id, i.order_id)          AS order_id,
       o.ordered_at::TIMESTAMP             AS ordered_at,
       o.customer                          AS customer_id,
       c.name                              AS customer_name,
       o.subtotal::INTEGER                 AS order_subtotal,
       o.tax_paid::INTEGER                 AS order_tax_paid,
       o.order_total::INTEGER              AS order_total,
       i.id                                AS order_item_id,
       i.sku                               AS sku,
       pr.name                             AS product_name,
       pr.type                             AS product_type,
       pr.price::INTEGER                   AS product_price
FROM stores s
FULL JOIN orders o      ON o.run = s.run AND o.store_id = s.id
FULL JOIN order_items i ON i.run = coalesce(o.run, s.run) AND i.order_id = o.id
LEFT JOIN customers c   ON c.run = coalesce(o.run, s.run) AND c.id = o.customer
LEFT JOIN products pr   ON pr.run = coalesce(i.run, o.run, s.run) AND pr.sku = i.sku;

-- 쓸 결과: 스냅샷 시각, 브론즈 실행, 파티션 열(dt, hr)을 붙인다
CREATE TEMP TABLE order_lines AS
SELECT strptime(p.dt || ' ' || p.hr, '%Y-%m-%d %H') AS snapshot_at,   -- 스냅샷 시각(UTC, 예정 시각)
       j.run                                      AS bronze_run,     -- 어느 브론즈 실행에서 왔는지
       j.* EXCLUDE (run),
       p.dt, p.hr                                                     -- 파티션 열(파일 안에는 없고 폴더 이름이 된다)
FROM joined j JOIN picked p USING (run);

COPY order_lines TO (lake_path('silver.jaffle_shop.order_lines'))
  (FORMAT csv, HEADER true, PARTITION_BY (dt, hr), OVERWRITE_OR_IGNORE true);

SELECT 'silver.jaffle_shop.order_lines' AS written, count(*) AS rows, count(DISTINCT (dt, hr)) AS partitions FROM order_lines;
