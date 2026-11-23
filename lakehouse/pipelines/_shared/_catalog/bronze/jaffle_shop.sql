-- 카탈로그: bronze.jaffle_shop(수집 결과, 원본 형식 그대로). ADR lakehouse/0002, 0003, 0005.
--   이름:   <층>.<스키마>.<표>             층 = catalog(_shared/_init.sql 의 ATTACH), 스키마 = 원천 종류
--   스키마: <층>.<스키마>.<표>_types()     열 이름 → 타입. 읽을 때 types= 로 쓴다. 열 이름이 바뀌거나 빠지면 읽기가 실패한다.
--   읽기:   <층>.<스키마>.<표>()           table macro. 위치 인자는 기본값이 있다(인자가 있어야 선언할 때 파일을 읽지 않는다).
--                                           읽기 옵션은 _shared/_init.sql 의 lake_csv() 하나에 있다.
--   쓰기:   lake_path('<층>.<스키마>.<표>')  표 폴더. 본문은 쓰는 층의 카탈로그를 읽지 않는다.
-- 쓰는 규칙은 수집기가 정한 한 가지(<표>/dt=/hr=/<실행 시각>_<실행 ID>.csv)라 쓰기는 lake_path('bronze.jaffle_shop.<표>') 하나다.
-- 읽기는 표마다 하나이고, 어느 실행인지 가리려고 파일 경로(filename)를 함께 돌려준다.
CREATE SCHEMA IF NOT EXISTS bronze.jaffle_shop;

CREATE OR REPLACE MACRO bronze.jaffle_shop.stores_types()      AS {'id': 'VARCHAR', 'name': 'VARCHAR', 'opened_at': 'VARCHAR', 'tax_rate': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.jaffle_shop.orders_types()      AS {'id': 'VARCHAR', 'customer': 'VARCHAR', 'ordered_at': 'VARCHAR', 'store_id': 'VARCHAR',
                                                                   'subtotal': 'VARCHAR', 'tax_paid': 'VARCHAR', 'order_total': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.jaffle_shop.order_items_types() AS {'id': 'VARCHAR', 'order_id': 'VARCHAR', 'sku': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.jaffle_shop.customers_types()   AS {'id': 'VARCHAR', 'name': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.jaffle_shop.products_types()    AS {'sku': 'VARCHAR', 'name': 'VARCHAR', 'type': 'VARCHAR', 'price': 'VARCHAR', 'description': 'VARCHAR'};

-- 스키마 안 모든 표의 브론즈 파일 목록(실행 고르기, 검증)
CREATE OR REPLACE MACRO bronze.jaffle_shop.files(root := getvariable('root')) AS TABLE
  FROM glob(lake_path('bronze.jaffle_shop', root := root) || '/*/dt=*/hr=*/*.csv');

CREATE OR REPLACE MACRO bronze.jaffle_shop.stores(root := getvariable('root'))      AS TABLE FROM lake_csv_with_file(lake_path('bronze.jaffle_shop.stores', root := root)      || '/dt=*/hr=*/*.csv', bronze.jaffle_shop.stores_types());
CREATE OR REPLACE MACRO bronze.jaffle_shop.customers(root := getvariable('root'))   AS TABLE FROM lake_csv_with_file(lake_path('bronze.jaffle_shop.customers', root := root)   || '/dt=*/hr=*/*.csv', bronze.jaffle_shop.customers_types());
CREATE OR REPLACE MACRO bronze.jaffle_shop.products(root := getvariable('root'))    AS TABLE FROM lake_csv_with_file(lake_path('bronze.jaffle_shop.products', root := root)    || '/dt=*/hr=*/*.csv', bronze.jaffle_shop.products_types());
CREATE OR REPLACE MACRO bronze.jaffle_shop.orders(root := getvariable('root'))      AS TABLE FROM lake_csv_with_file(lake_path('bronze.jaffle_shop.orders', root := root)      || '/dt=*/hr=*/*.csv', bronze.jaffle_shop.orders_types());
CREATE OR REPLACE MACRO bronze.jaffle_shop.order_items(root := getvariable('root')) AS TABLE FROM lake_csv_with_file(lake_path('bronze.jaffle_shop.order_items', root := root) || '/dt=*/hr=*/*.csv', bronze.jaffle_shop.order_items_types());
