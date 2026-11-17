-- 층별 카탈로그: bronze(수집 결과, 원본 형식 그대로). 이름 규칙은 _catalog_source.sql 머리말과 같다.
-- 쓰는 규칙은 수집기가 정한 한 가지(<표>/dt=/hr=/<실행 시각>_<실행 ID>.csv)라 쓰기 경로만 표 이름을 인자로 받는다.
-- 읽기는 표마다 하나이고, 어느 실행인지 가리려고 파일 경로(filename)를 함께 돌려준다.

CREATE MACRO bronze_stores_types()      AS {'id': 'VARCHAR', 'name': 'VARCHAR', 'opened_at': 'VARCHAR', 'tax_rate': 'VARCHAR'};
CREATE MACRO bronze_orders_types()      AS {'id': 'VARCHAR', 'customer': 'VARCHAR', 'ordered_at': 'VARCHAR', 'store_id': 'VARCHAR',
                                            'subtotal': 'VARCHAR', 'tax_paid': 'VARCHAR', 'order_total': 'VARCHAR'};
CREATE MACRO bronze_order_items_types() AS {'id': 'VARCHAR', 'order_id': 'VARCHAR', 'sku': 'VARCHAR'};
CREATE MACRO bronze_customers_types()   AS {'id': 'VARCHAR', 'name': 'VARCHAR'};
CREATE MACRO bronze_products_types()    AS {'sku': 'VARCHAR', 'name': 'VARCHAR', 'type': 'VARCHAR', 'price': 'VARCHAR', 'description': 'VARCHAR'};

CREATE MACRO bronze_jaffle_shop_path(tbl, root := getvariable('root')) AS root || '/bronze/jaffle_shop/' || tbl;
CREATE MACRO bronze_jaffle_shop_files(root := getvariable('root')) AS TABLE
  FROM glob(root || '/bronze/jaffle_shop/*/dt=*/hr=*/*.csv');

CREATE MACRO bronze_stores(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('stores', root := root) || '/dt=*/hr=*/*.csv', types = bronze_stores_types(),
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
CREATE MACRO bronze_customers(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('customers', root := root) || '/dt=*/hr=*/*.csv', types = bronze_customers_types(),
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
CREATE MACRO bronze_products(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('products', root := root) || '/dt=*/hr=*/*.csv', types = bronze_products_types(),
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
CREATE MACRO bronze_orders(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('orders', root := root) || '/dt=*/hr=*/*.csv', types = bronze_orders_types(),
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
CREATE MACRO bronze_order_items(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('order_items', root := root) || '/dt=*/hr=*/*.csv', types = bronze_order_items_types(),
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
