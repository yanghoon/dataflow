-- 층별 카탈로그: gold. 이름 규칙은 _catalog/source.sql 머리말과 같다. 주문 날짜(dt 폴더)별 파티션이고, dt 는 열이 아니다.

CREATE MACRO gold_store_daily_sales_types() AS {
  'snapshot_at': 'TIMESTAMP', 'store_id': 'VARCHAR', 'store_name': 'VARCHAR', 'order_date': 'DATE',
  'orders': 'BIGINT', 'revenue_cents': 'BIGINT', 'tax_cents': 'BIGINT', 'avg_order_cents': 'BIGINT'};
CREATE MACRO gold_product_daily_sales_types() AS {
  'snapshot_at': 'TIMESTAMP', 'order_date': 'DATE', 'product_type': 'VARCHAR', 'sku': 'VARCHAR', 'product_name': 'VARCHAR',
  'items_sold': 'BIGINT', 'item_revenue_cents': 'BIGINT'};

CREATE MACRO gold_store_daily_sales_path(root := getvariable('root'))   AS root || '/gold/jaffle_shop/store_daily_sales';
CREATE MACRO gold_product_daily_sales_path(root := getvariable('root')) AS root || '/gold/jaffle_shop/product_daily_sales';

CREATE MACRO gold_store_daily_sales(root := getvariable('root')) AS TABLE
  FROM read_csv(gold_store_daily_sales_path(root := root) || '/dt=*/*.csv', types = gold_store_daily_sales_types(),
                header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false);
CREATE MACRO gold_product_daily_sales(root := getvariable('root')) AS TABLE
  FROM read_csv(gold_product_daily_sales_path(root := root) || '/dt=*/*.csv', types = gold_product_daily_sales_types(),
                header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false);
