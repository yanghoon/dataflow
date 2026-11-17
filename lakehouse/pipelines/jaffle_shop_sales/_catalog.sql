-- jaffle_shop_sales 의 테이블 위치, 읽기 옵션, 타입 변환을 한 곳에 둔다(ADR lakehouse/0002).
-- 본문은 _init.sql 다음에 이 파일을 읽고, 이름으로만 읽고 쓴다.
--   읽기: <층>_<표>()       table macro. 위치 인자(root 등)는 기본값이 있다.
--         인자가 있어야 DuckDB가 선언할 때 파일을 읽지 않는다(아직 없는 출력도 선언할 수 있다).
--   쓰기: <층>_<표>_path()  scalar macro. COPY ... TO (<층>_<표>_path())
-- CSV는 타입이 없어 모든 열을 문자열로 읽고(all_varchar), 실버만 여기서 타입을 정한다.

-- origin: 자르기 전 원본(00번만 읽는다)
CREATE MACRO origin_raw_stores(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_stores.csv', header = true, all_varchar = true);
CREATE MACRO origin_raw_orders(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_orders.csv', header = true, all_varchar = true);
CREATE MACRO origin_raw_order_items(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_order_items.csv', header = true, all_varchar = true);
CREATE MACRO origin_raw_customers(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_customers.csv', header = true, all_varchar = true);
CREATE MACRO origin_raw_products(url := getvariable('origin_root')) AS TABLE
  FROM read_csv(url || '/raw_products.csv', header = true, all_varchar = true);

-- source: 시험용 원본
CREATE MACRO source_raw_stores_path(root := getvariable('source_root'))      AS root || '/jaffle_shop/raw_stores.csv';
CREATE MACRO source_raw_orders_path(root := getvariable('source_root'))      AS root || '/jaffle_shop/raw_orders.csv';
CREATE MACRO source_raw_order_items_path(root := getvariable('source_root')) AS root || '/jaffle_shop/raw_order_items.csv';
CREATE MACRO source_raw_customers_path(root := getvariable('source_root'))   AS root || '/jaffle_shop/raw_customers.csv';
CREATE MACRO source_raw_products_path(root := getvariable('source_root'))    AS root || '/jaffle_shop/raw_products.csv';

CREATE MACRO source_raw_stores(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_stores_path(root := root), header = true, all_varchar = true);
CREATE MACRO source_raw_orders(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_orders_path(root := root), header = true, all_varchar = true);
CREATE MACRO source_raw_order_items(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_order_items_path(root := root), header = true, all_varchar = true);
CREATE MACRO source_raw_customers(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_customers_path(root := root), header = true, all_varchar = true);
CREATE MACRO source_raw_products(root := getvariable('source_root')) AS TABLE
  FROM read_csv(source_raw_products_path(root := root), header = true, all_varchar = true);

-- bronze: 수집 결과. 쓰는 규칙은 수집기가 정한 한 가지(<표>/dt=/hr=/<실행 시각>_<실행 ID>.csv)라 표 이름을 인자로 받는다.
-- 읽기는 표마다 하나이고, 어느 실행인지 가리려고 파일 경로(filename)를 함께 돌려준다.
CREATE MACRO bronze_jaffle_shop_path(tbl, root := getvariable('root')) AS root || '/bronze/jaffle_shop/' || tbl;
CREATE MACRO bronze_jaffle_shop_files(root := getvariable('root')) AS TABLE
  FROM glob(root || '/bronze/jaffle_shop/*/dt=*/hr=*/*.csv');

CREATE MACRO bronze_stores(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('stores', root := root) || '/dt=*/hr=*/*.csv',
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
CREATE MACRO bronze_customers(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('customers', root := root) || '/dt=*/hr=*/*.csv',
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
CREATE MACRO bronze_products(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('products', root := root) || '/dt=*/hr=*/*.csv',
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
CREATE MACRO bronze_orders(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('orders', root := root) || '/dt=*/hr=*/*.csv',
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);
CREATE MACRO bronze_order_items(root := getvariable('root')) AS TABLE
  FROM read_csv(bronze_jaffle_shop_path('order_items', root := root) || '/dt=*/hr=*/*.csv',
                header = true, all_varchar = true, allow_quoted_nulls = false, filename = true, hive_partitioning = false);

-- silver: 주문 품목 한 행. 스냅샷(dt/hr)마다 전체가 들어 있다.
CREATE MACRO silver_order_lines_path(root := getvariable('root')) AS root || '/silver/jaffle_shop/order_lines';
CREATE MACRO silver_order_lines(root := getvariable('root')) AS TABLE
  SELECT * REPLACE (snapshot_at::TIMESTAMP     AS snapshot_at,
                    store_opened_at::TIMESTAMP AS store_opened_at,
                    store_tax_rate::DOUBLE     AS store_tax_rate,
                    ordered_at::TIMESTAMP      AS ordered_at,
                    order_subtotal::INTEGER    AS order_subtotal,
                    order_tax_paid::INTEGER    AS order_tax_paid,
                    order_total::INTEGER       AS order_total,
                    product_price::INTEGER     AS product_price)
  FROM read_csv(silver_order_lines_path(root := root) || '/dt=*/hr=*/*.csv',
                header = true, all_varchar = true, allow_quoted_nulls = false, hive_partitioning = false);
-- 골드와 검증이 함께 쓰는 기준: 가장 늦은 스냅샷 하나만 쓴다
CREATE MACRO silver_order_lines_latest(root := getvariable('root')) AS TABLE
  FROM silver_order_lines(root := root) QUALIFY snapshot_at = max(snapshot_at) OVER ();

-- gold: 주문 날짜(dt)별 파티션
CREATE MACRO gold_store_daily_sales_path(root := getvariable('root'))   AS root || '/gold/jaffle_shop/store_daily_sales';
CREATE MACRO gold_product_daily_sales_path(root := getvariable('root')) AS root || '/gold/jaffle_shop/product_daily_sales';
CREATE MACRO gold_store_daily_sales(root := getvariable('root')) AS TABLE
  FROM read_csv(gold_store_daily_sales_path(root := root) || '/dt=*/*.csv', header = true, hive_partitioning = false);
CREATE MACRO gold_product_daily_sales(root := getvariable('root')) AS TABLE
  FROM read_csv(gold_product_daily_sales_path(root := root) || '/dt=*/*.csv', header = true, hive_partitioning = false);
