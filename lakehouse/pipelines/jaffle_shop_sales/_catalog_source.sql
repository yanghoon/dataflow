-- 층별 카탈로그: origin(자르기 전 원본)과 source(시험용 원본). ADR lakehouse/0002.
--   스키마: <층>_<표>_types()  열 이름 → 타입. 읽을 때 types= 로 쓴다. 열 이름이 바뀌거나 빠지면 읽기가 실패한다.
--   읽기:   <층>_<표>()        table macro. 위치 인자는 기본값이 있다(인자가 있어야 선언할 때 파일을 읽지 않는다).
--   쓰기:   <층>_<표>_path()   scalar macro. COPY ... TO (<층>_<표>_path())
-- 원본 형식을 바꾸지 않으므로 모든 열은 문자열이다. origin 과 source 는 같은 스키마를 쓴다.

CREATE MACRO source_raw_stores_types()      AS {'id': 'VARCHAR', 'name': 'VARCHAR', 'opened_at': 'VARCHAR', 'tax_rate': 'VARCHAR'};
CREATE MACRO source_raw_orders_types()      AS {'id': 'VARCHAR', 'customer': 'VARCHAR', 'ordered_at': 'VARCHAR', 'store_id': 'VARCHAR',
                                                'subtotal': 'VARCHAR', 'tax_paid': 'VARCHAR', 'order_total': 'VARCHAR'};
CREATE MACRO source_raw_order_items_types() AS {'id': 'VARCHAR', 'order_id': 'VARCHAR', 'sku': 'VARCHAR'};
CREATE MACRO source_raw_customers_types()   AS {'id': 'VARCHAR', 'name': 'VARCHAR'};
CREATE MACRO source_raw_products_types()    AS {'sku': 'VARCHAR', 'name': 'VARCHAR', 'type': 'VARCHAR', 'price': 'VARCHAR', 'description': 'VARCHAR'};

-- origin: 00번만 읽는다
CREATE MACRO origin_raw_stores(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_stores.csv', header = true, all_varchar = true, types = source_raw_stores_types());
CREATE MACRO origin_raw_orders(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_orders.csv', header = true, all_varchar = true, types = source_raw_orders_types());
CREATE MACRO origin_raw_order_items(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_order_items.csv', header = true, all_varchar = true, types = source_raw_order_items_types());
CREATE MACRO origin_raw_customers(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_customers.csv', header = true, all_varchar = true, types = source_raw_customers_types());
CREATE MACRO origin_raw_products(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_products.csv', header = true, all_varchar = true, types = source_raw_products_types());

-- source
CREATE MACRO source_raw_stores_path(root := getvariable('source_root'))      AS root || '/jaffle_shop/raw_stores.csv';
CREATE MACRO source_raw_orders_path(root := getvariable('source_root'))      AS root || '/jaffle_shop/raw_orders.csv';
CREATE MACRO source_raw_order_items_path(root := getvariable('source_root')) AS root || '/jaffle_shop/raw_order_items.csv';
CREATE MACRO source_raw_customers_path(root := getvariable('source_root'))   AS root || '/jaffle_shop/raw_customers.csv';
CREATE MACRO source_raw_products_path(root := getvariable('source_root'))    AS root || '/jaffle_shop/raw_products.csv';

CREATE MACRO source_raw_stores(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_stores_path(root := root), header = true, all_varchar = true, types = source_raw_stores_types());
CREATE MACRO source_raw_orders(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_orders_path(root := root), header = true, all_varchar = true, types = source_raw_orders_types());
CREATE MACRO source_raw_order_items(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_order_items_path(root := root), header = true, all_varchar = true, types = source_raw_order_items_types());
CREATE MACRO source_raw_customers(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_customers_path(root := root), header = true, all_varchar = true, types = source_raw_customers_types());
CREATE MACRO source_raw_products(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_products_path(root := root), header = true, all_varchar = true, types = source_raw_products_types());
