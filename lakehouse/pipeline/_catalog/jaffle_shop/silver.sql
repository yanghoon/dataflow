-- 카탈로그: silver.jaffle_shop. 이름 규칙은 _catalog/jaffle_shop/bronze.sql 머리말과 같다.
-- order_lines: 한 행 = 주문 품목 하나. 스냅샷(dt/hr 폴더)마다 전체가 들어 있다. dt, hr 는 폴더 이름이라 열이 아니다.
CREATE SCHEMA IF NOT EXISTS silver.jaffle_shop;

CREATE OR REPLACE MACRO silver.jaffle_shop.order_lines_types() AS {
  'snapshot_at': 'TIMESTAMP', 'bronze_run': 'VARCHAR',
  'store_id': 'VARCHAR', 'store_name': 'VARCHAR', 'store_opened_at': 'TIMESTAMP', 'store_tax_rate': 'DOUBLE',
  'order_id': 'VARCHAR', 'ordered_at': 'TIMESTAMP', 'customer_id': 'VARCHAR', 'customer_name': 'VARCHAR',
  'order_subtotal': 'INTEGER', 'order_tax_paid': 'INTEGER', 'order_total': 'INTEGER',
  'order_item_id': 'VARCHAR', 'sku': 'VARCHAR', 'product_name': 'VARCHAR', 'product_type': 'VARCHAR', 'product_price': 'INTEGER'};

CREATE OR REPLACE MACRO silver.jaffle_shop.order_lines(root := getvariable('root')) AS TABLE
  FROM lake_csv(lake_path('silver.jaffle_shop.order_lines', root := root) || '/dt=*/hr=*/*.csv', silver.jaffle_shop.order_lines_types());

-- 골드와 검증이 함께 쓰는 기준: 가장 늦은 스냅샷 하나만 쓴다
CREATE OR REPLACE MACRO silver.jaffle_shop.order_lines_latest(root := getvariable('root')) AS TABLE
  FROM silver.jaffle_shop.order_lines(root := root) QUALIFY snapshot_at = max(snapshot_at) OVER ();
