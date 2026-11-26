-- tier 사이 숫자가 맞는지 본다. 시험용 원본 없이 돈다(정기 실행에 넣는다). ok 열이 모두 true 여야 한다.
-- 원본과 비교하는 검사는 _sample/90_checks.sql 에 있다.
.read pipeline/_init/base.sql
.read pipeline/_catalog/jaffle_shop/silver.sql
.read pipeline/_catalog/jaffle_shop/gold.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   silver  읽기  silver.jaffle_shop.order_lines_latest()   가장 늦은 스냅샷
--   gold    읽기  gold.jaffle_shop.product_daily_sales()    골드 상품 판매 수

CREATE TEMP TABLE silver_last  AS FROM silver.jaffle_shop.order_lines_latest();  -- 실버 가장 늦은 스냅샷
CREATE TEMP TABLE gold_product AS FROM gold.jaffle_shop.product_daily_sales();   -- 골드 상품 × 날짜

SELECT check_name, expected, actual, expected = actual AS ok FROM (VALUES
  ('gold: 상품 판매 수 = silver 마지막 품목 행',
     (SELECT count(*) FROM silver_last WHERE order_item_id IS NOT NULL),
     (SELECT sum(items_sold)::BIGINT FROM gold_product))
) v(check_name, expected, actual);
