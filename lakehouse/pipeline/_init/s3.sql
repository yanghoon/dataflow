-- S3를 읽고 쓸 때만 읽는다. 로컬 디스크에서는 쓰지 않는다. pipeline/.env 에 두 줄을 쓴다:
--   DATA_ROOT=s3://local
--   INIT_FILES="pipeline/_init/base.sql pipeline/_init/s3.sql"
-- S3가 더 생기면 _init/s3_<이름>.sql 을 더하고, 비밀 이름·SCOPE 's3://<버킷>'·환경 변수 접두사를 파일마다 다르게 한다(ADR lakehouse/0002).
-- 이 파일은 secret 만 더한다. 아래 s3_* 변수는 CREATE SECRET 에 기본값을 넘기는 데만 쓴다.
-- 값은 환경 변수에서만 읽는다. TEMPORARY 라 프로세스가 끝나면 사라진다(PERSISTENT 는 평문으로 남으므로 쓰지 않는다).
INSTALL httpfs;
LOAD httpfs;
-- CREATE SECRET 안에는 coalesce 같은 식을 쓸 수 없어(DuckDB 2.0) 기본값을 변수로 먼저 정한다
SET VARIABLE s3_region    = coalesce(nullif(getenv('S3_REGION'), ''), 'us-east-1');
SET VARIABLE s3_url_style = coalesce(nullif(getenv('S3_URL_STYLE'), ''), 'path');
SET VARIABLE s3_use_ssl   = coalesce(nullif(getenv('S3_USE_SSL'), ''), 'true')::BOOLEAN;
CREATE TEMPORARY SECRET sample_s3 (
  TYPE s3,
  KEY_ID    getenv('S3_ACCESS_KEY_ID'),
  SECRET    getenv('S3_SECRET_KEY_ID'),
  ENDPOINT  getenv('S3_ENDPOINT'),
  REGION    getvariable('s3_region'),
  URL_STYLE getvariable('s3_url_style'),
  USE_SSL   getvariable('s3_use_ssl')
);
