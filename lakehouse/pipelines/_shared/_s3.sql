-- 서버에서 S3를 읽고 쓸 때만 -cmd 로 먼저 읽는다. 로컬 디스크에서는 쓰지 않는다.
--   duckdb -cmd ".read pipelines/_shared/_s3.sql" < pipelines/jaffle_shop_sales/20_silver_order_lines.sql
-- 값은 환경 변수에서만 읽는다. TEMPORARY 라 프로세스가 끝나면 사라진다(PERSISTENT 는 평문으로 남으므로 쓰지 않는다).
INSTALL httpfs;
LOAD httpfs;
CREATE TEMPORARY SECRET sample_s3 (
  TYPE s3,
  KEY_ID    getenv('S3_ACCESS_KEY_ID'),
  SECRET    getenv('S3_SECRET_KEY_ID'),
  ENDPOINT  getenv('S3_ENDPOINT'),
  REGION    coalesce(nullif(getenv('S3_REGION'), ''), 'us-east-1'),
  URL_STYLE coalesce(nullif(getenv('S3_URL_STYLE'), ''), 'path'),
  USE_SSL   coalesce(nullif(getenv('S3_USE_SSL'), ''), 'true')::BOOLEAN
);
