-- silver.jaffle_shop.order_lines(가장 늦은 스냅샷) → gold.jaffle_shop.store_daily_sales(dt = 주문 날짜)
-- 매장 × 날짜를 집계한다. 금액 단위는 센트(원본과 같음).
-- 합계는 BIGINT로 바꿔 쓴다(sum()은 HUGEINT를 돌려준다).
.read pipeline/_init/base.sql
.read pipeline/_catalog/jaffle_shop/silver.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   silver  읽기  silver.jaffle_shop.order_lines_latest()    가장 늦은 스냅샷의 주문 품목
--   gold    쓰기  lake_path('gold.jaffle_shop.store_daily_sales')  매장 × 주문 날짜(dt)

CREATE TEMP TABLE s AS FROM silver.jaffle_shop.order_lines_latest();  -- 아래에서 여러 번 쓰므로 한 번만 읽는다

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

-- 쓸 결과: 뼈대에 주문을 붙여 매장 × 날짜로 집계한다
CREATE TEMP TABLE store_daily_sales AS
SELECT (SELECT max(snapshot_at) FROM s)                AS snapshot_at,
       sp.store_id, sp.store_name, sp.order_date,
       count(o.order_id)                               AS orders,
       coalesce(sum(o.order_total), 0)::BIGINT         AS revenue_cents,
       coalesce(sum(o.order_tax_paid), 0)::BIGINT      AS tax_cents,
       CASE WHEN count(o.order_id) > 0 THEN round(sum(o.order_total) / count(o.order_id))::BIGINT END AS avg_order_cents,
       strftime(sp.order_date, '%Y-%m-%d')             AS dt
FROM spine sp
LEFT JOIN orders_d o ON o.store_id = sp.store_id AND o.order_date = sp.order_date
GROUP BY sp.store_id, sp.store_name, sp.order_date;

COPY store_daily_sales TO (lake_path('gold.jaffle_shop.store_daily_sales'))
  (FORMAT csv, HEADER true, PARTITION_BY (dt), OVERWRITE_OR_IGNORE true);

SELECT 'gold.jaffle_shop.store_daily_sales' AS written, count(*) AS rows, count(DISTINCT dt) AS partitions FROM store_daily_sales;
