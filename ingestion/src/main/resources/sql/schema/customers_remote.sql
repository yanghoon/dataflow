-- Enable 'postgres_fdw' plugin
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Create 'customers_csv_fdw' that remote table of 'customers_csv' at localhost
-- TODO: 접속할 원격 서버 환경에 맞게 host, port, dbname 값을 변경하세요.
CREATE SERVER IF NOT EXISTS localhost_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host 'localhost', port '5432', dbname 'dataflow');

-- Create credential of 'customer_csv_fdw' to remote access
-- TODO: 로컬 사용자(FOR "...")와 원격 서버 접속 자격 증명(user, password)을 환경에 맞게 변경하세요.
CREATE USER MAPPING IF NOT EXISTS FOR "postgres-local"
    SERVER localhost_server
    OPTIONS (user 'postgres-local', password 'postgres-local');

-- Create 'customers_csv_fdw' remote table
CREATE FOREIGN TABLE IF NOT EXISTS customers_csv_fdw (
    index_id INTEGER,
    customer_id VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    phone_1 VARCHAR(50),
    phone_2 VARCHAR(50),
    email VARCHAR(255),
    subscription_date DATE,
    website VARCHAR(255)
)
SERVER localhost_server
OPTIONS (schema_name 'public', table_name 'customers_csv');
