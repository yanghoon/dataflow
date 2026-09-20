CREATE TABLE IF NOT EXISTS departments_csv (
    customer_id VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
    snapshot_date DATE NOT NULL,              -- 데이터 스냅샷 날짜
    system_id VARCHAR(50) NOT NULL,               -- 시스템 내부용 고유 ID

    customer_id VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL
);
