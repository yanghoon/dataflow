-- 카탈로그: gold.jaffle_shop. 이름 규칙은 _catalog/jaffle_shop/bronze.sql 머리말과 같다. 주문 날짜(dt 폴더)별 파티션이고, dt 는 열이 아니다.
CREATE SCHEMA IF NOT EXISTS gold.jaffle_shop;

CREATE OR REPLACE MACRO gold.jaffle_shop.store_daily_sales_types() AS {
  'snapshot_at': 'TIMESTAMP', 'store_id': 'VARCHAR', 'store_name': 'VARCHAR', 'order_date': 'DATE',
  'orders': 'BIGINT', 'revenue_cents': 'BIGINT', 'tax_cents': 'BIGINT', 'avg_order_cents': 'BIGINT'};
CREATE OR REPLACE MACRO gold.jaffle_shop.product_daily_sales_types() AS {
  'snapshot_at': 'TIMESTAMP', 'order_date': 'DATE', 'product_type': 'VARCHAR', 'sku': 'VARCHAR', 'product_name': 'VARCHAR',
  'items_sold': 'BIGINT', 'item_revenue_cents': 'BIGINT'};

CREATE OR REPLACE MACRO gold.jaffle_shop.store_daily_sales(root := getvariable('root')) AS TABLE
  FROM lake_csv(lake_path('gold.jaffle_shop.store_daily_sales', root := root) || '/dt=*/*.csv', gold.jaffle_shop.store_daily_sales_types());
CREATE OR REPLACE MACRO gold.jaffle_shop.product_daily_sales(root := getvariable('root')) AS TABLE
  FROM lake_csv(lake_path('gold.jaffle_shop.product_daily_sales', root := root) || '/dt=*/*.csv', gold.jaffle_shop.product_daily_sales_types());
