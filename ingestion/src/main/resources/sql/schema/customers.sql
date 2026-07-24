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
    website VARCHAR(255),
    snapshot_date DATE NOT NULL
);
