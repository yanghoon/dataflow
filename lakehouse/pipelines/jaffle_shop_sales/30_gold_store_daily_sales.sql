-- <DATA_ROOT>/silver/jaffle_shop/order_lines → <DATA_ROOT>/gold/jaffle_shop/store_daily_sales/dt=<주문 날짜>/data_0.csv
-- 가장 늦은 실버 스냅샷 하나로 매장 × 날짜를 집계한다. 금액 단위는 센트(원본과 같음).
-- 합계는 BIGINT로 바꿔 쓴다(sum()은 HUGEINT를 돌려준다).
.read pipelines/_shared/_init.sql

-- 실버 CSV는 문자열로 읽고 필요한 열만 타입을 바꾼다
CREATE TEMP TABLE s AS
SELECT * REPLACE (snapshot_at::TIMESTAMP AS snapshot_at, store_opened_at::TIMESTAMP AS store_opened_at,
                  ordered_at::TIMESTAMP AS ordered_at, order_total::INTEGER AS order_total,
                  order_tax_paid::INTEGER AS order_tax_paid, product_price::INTEGER AS product_price)
FROM read_csv(getvariable('root') || '/silver/jaffle_shop/order_lines/dt=*/hr=*/*.csv',
              header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false)
QUALIFY snapshot_at::TIMESTAMP = max(snapshot_at::TIMESTAMP) OVER ();

-- 주문 하나 = 한 행(실버는 품목 단위라 주문 금액이 품목 수만큼 반복된다)
CREATE TEMP TABLE orders_d AS
SELECT DISTINCT store_id, order_id, ordered_at::DATE AS order_date, order_total, order_tax_paid
FROM s WHERE order_id IS NOT NULL;

-- 매장 × 날짜 뼈대: 그날 열려 있던 매장은 주문이 없어도 0으로 남긴다
CREATE TEMP TABLE spine AS
SELECT DISTINCT st.store_id, st.store_name, d.order_date
FROM (SELECT DISTINCT store_id, store_name, store_opened_at FROM s WHERE store_name IS NOT NULL) st
CROSS JOIN (SELECT (getvariable('start_day') + to_days(n::INTEGER))::DATE AS order_date
            FROM range(0, getvariable('days')) r(n)) d
WHERE st.store_opened_at::DATE <= d.order_date;

COPY (
  SELECT (SELECT max(snapshot_at) FROM s)                AS snapshot_at,
         sp.store_id, sp.store_name, sp.order_date,
         count(o.order_id)                               AS orders,
         coalesce(sum(o.order_total), 0)::BIGINT         AS revenue_cents,
         coalesce(sum(o.order_tax_paid), 0)::BIGINT      AS tax_cents,
         CASE WHEN count(o.order_id) > 0 THEN round(sum(o.order_total) / count(o.order_id))::BIGINT END AS avg_order_cents,
         strftime(sp.order_date, '%Y-%m-%d')             AS dt
  FROM spine sp
  LEFT JOIN orders_d o ON o.store_id = sp.store_id AND o.order_date = sp.order_date
  GROUP BY sp.store_id, sp.store_name, sp.order_date
) TO (getvariable('root') || '/gold/jaffle_shop/store_daily_sales')
  (FORMAT csv, HEADER true, PARTITION_BY (dt), OVERWRITE_OR_IGNORE true);

SELECT store_name, order_date, orders, revenue_cents
FROM read_csv(getvariable('root') || '/gold/jaffle_shop/store_daily_sales/dt=*/*.csv', header = true, hive_partitioning = false)
ORDER BY order_date, store_name;
