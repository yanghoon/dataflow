-- <DATA_ROOT>/silver/jaffle_shop/order_lines → <DATA_ROOT>/gold/jaffle_shop/product_daily_sales/dt=<주문 날짜>/data_0.csv
-- 가장 늦은 실버 스냅샷 하나로 상품 × 날짜를 집계한다. 금액 단위는 센트(원본과 같음).
.read pipelines/_shared/_init.sql

-- 실버 CSV는 문자열로 읽고 필요한 열만 타입을 바꾼다
CREATE TEMP TABLE s AS
SELECT * REPLACE (snapshot_at::TIMESTAMP AS snapshot_at, store_opened_at::TIMESTAMP AS store_opened_at,
                  ordered_at::TIMESTAMP AS ordered_at, order_total::INTEGER AS order_total,
                  order_tax_paid::INTEGER AS order_tax_paid, product_price::INTEGER AS product_price)
FROM read_csv(getvariable('root') || '/silver/jaffle_shop/order_lines/dt=*/hr=*/*.csv',
              header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false)
QUALIFY snapshot_at::TIMESTAMP = max(snapshot_at::TIMESTAMP) OVER ();

COPY (
  SELECT max(snapshot_at)                        AS snapshot_at,
         ordered_at::DATE                        AS order_date,
         product_type, sku, product_name,
         count(*)                                AS items_sold,
         sum(product_price)::BIGINT              AS item_revenue_cents,
         strftime(ordered_at::DATE, '%Y-%m-%d')  AS dt
  FROM s WHERE order_item_id IS NOT NULL
  GROUP BY ALL
) TO (getvariable('root') || '/gold/jaffle_shop/product_daily_sales')
  (FORMAT csv, HEADER true, PARTITION_BY (dt), OVERWRITE_OR_IGNORE true);

SELECT order_date, product_type, sum(items_sold) AS items_sold, sum(item_revenue_cents) AS item_revenue_cents
FROM read_csv(getvariable('root') || '/gold/jaffle_shop/product_daily_sales/dt=*/*.csv', header = true, hive_partitioning = false)
GROUP BY ALL ORDER BY ALL;
