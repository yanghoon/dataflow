-- https://github.com/datablist/sample-csv-files
CREATE TABLE customers_csv (
    index_id INTEGER PRIMARY KEY,           -- CSV의 'Index' 컬럼
    customer_id VARCHAR(50) UNIQUE NOT NULL, -- 영문/숫자 혼합 고유 ID
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    phone_1 VARCHAR(50),                     -- 국가코드(+), 괄호, 내선번호(x) 포함을 위해 VARCHAR 사용
    phone_2 VARCHAR(50),                     
    email VARCHAR(255),
    subscription_date DATE,                  -- 'YYYY-MM-DD' 형식에 맞는 표준 DATE 타입
    website VARCHAR(255)
);

CREATE TABLE customers (
    index_id INTEGER,           -- CSV의 'Index' 컬럼
    customer_id VARCHAR(50) UNIQUE NOT NULL, -- 영문/숫자 혼합 고유 ID
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    phone_1 VARCHAR(50),                     -- 국가코드(+), 괄호, 내선번호(x) 포함을 위해 VARCHAR 사용
    phone_2 VARCHAR(50),                     
    email VARCHAR(255),
    subscription_date DATE,                  -- 'YYYY-MM-DD' 형식에 맞는 표준 DATE 타입
    website VARCHAR(255),
    snapshot_date DATE NOT NULL,

    PRIMARY KEY (snapshot_date, index_id),
    UNIQUE (snapshot_date, customer_id)
);
-- ) PARTITION BY RANGE (snapshot_date);

-- ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_pkey;
-- ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_customer_id_key;
-- ALTER TABLE customers ADD PRIMARY KEY (snapshot_date, index_id);
-- ALTER TABLE customers ADD UNIQUE (snapshot_date, customer_id);

-- CREATE TABLE IF NOT EXISTS customer_subscriptions_20260725 
-- PARTITION OF customer_subscriptions 
-- FOR VALUES FROM ('2026-07-25') TO ('2026-07-26');

-- CREATE OR REPLACE FUNCTION create_daily_partition(p_date DATE)
-- RETURNS void AS $$
-- DECLARE
--     v_partition_name TEXT;
--     v_next_date DATE;
-- BEGIN
--     -- 1. 테이블 이름 조립 (예: customer_subscriptions_20260725)
--     v_partition_name := 'customer_subscriptions_' || to_char(p_date, 'YYYYMMDD');
--     -- 2. 다음 날짜 계산 (DB 내부에서 자동 계산)
--     v_next_date := p_date + INTERVAL '1 day';
--     -- 3. 동적 DDL 실행 (IF NOT EXISTS 포함)
--     EXECUTE format(
--         'CREATE TABLE IF NOT EXISTS %I PARTITION OF customer_subscriptions FOR VALUES FROM (%L) TO (%L)',
--         v_partition_name, p_date, v_next_date
--     );
-- END;
-- $$ LANGUAGE plpgsql;
