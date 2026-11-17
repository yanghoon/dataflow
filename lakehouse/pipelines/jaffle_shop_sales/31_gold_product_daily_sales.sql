-- silver.order_lines(가장 늦은 스냅샷) → gold.product_daily_sales(dt = 주문 날짜)
-- 상품 × 날짜를 집계한다. 금액 단위는 센트(원본과 같음).
.read pipelines/_shared/_init.sql
.read pipelines/jaffle_shop_sales/_catalog.sql

CREATE TEMP TABLE product_daily_sales AS
SELECT max(snapshot_at)                        AS snapshot_at,
       ordered_at::DATE                        AS order_date,
       product_type, sku, product_name,
       count(*)                                AS items_sold,
       sum(product_price)::BIGINT              AS item_revenue_cents,
       strftime(ordered_at::DATE, '%Y-%m-%d')  AS dt
FROM silver_order_lines_latest()
WHERE order_item_id IS NOT NULL
GROUP BY ALL;

COPY product_daily_sales TO (gold_product_daily_sales_path())
  (FORMAT csv, HEADER true, PARTITION_BY (dt), OVERWRITE_OR_IGNORE true);

SELECT 'gold.product_daily_sales' AS written, count(*) AS rows, count(DISTINCT dt) AS partitions FROM product_daily_sales;
