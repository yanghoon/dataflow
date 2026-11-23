-- silver.jaffle_shop.order_lines(가장 늦은 스냅샷) → gold.jaffle_shop.product_daily_sales(dt = 주문 날짜)
-- 상품 × 날짜를 집계한다. 금액 단위는 센트(원본과 같음).
.read pipelines/_shared/_init.sql
.read pipelines/_shared/_catalog/silver/jaffle_shop.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   silver  읽기  silver.jaffle_shop.order_lines_latest()      가장 늦은 스냅샷의 주문 품목
--   gold    쓰기  lake_path('gold.jaffle_shop.product_daily_sales')  상품 × 주문 날짜(dt)

-- 쓸 결과: 품목 행을 상품 × 날짜로 센다
CREATE TEMP TABLE product_daily_sales AS
SELECT max(snapshot_at)                        AS snapshot_at,
       ordered_at::DATE                        AS order_date,
       product_type, sku, product_name,
       count(*)                                AS items_sold,
       sum(product_price)::BIGINT              AS item_revenue_cents,
       strftime(ordered_at::DATE, '%Y-%m-%d')  AS dt
FROM silver.jaffle_shop.order_lines_latest()
WHERE order_item_id IS NOT NULL
GROUP BY ALL;

COPY product_daily_sales TO (lake_path('gold.jaffle_shop.product_daily_sales'))
  (FORMAT csv, HEADER true, PARTITION_BY (dt), OVERWRITE_OR_IGNORE true);

SELECT 'gold.jaffle_shop.product_daily_sales' AS written, count(*) AS rows, count(DISTINCT dt) AS partitions FROM product_daily_sales;
