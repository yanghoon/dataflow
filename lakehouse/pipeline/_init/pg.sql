-- gold tier를 Postgres 로 붙인다. Postgres 에 gold 를 쓸 때만 읽는다. pipeline/.env 에 쓴다:
--   INIT_FILES="pipeline/_init/pg.sql pipeline/_init/base.sql"
--   PG_HOST=…  PG_DATABASE=…  PG_USER=…  PG_PASSWORD=…
-- 이 파일은 secret 과 ATTACH 만 더한다. 아래 pg_* 변수는 CREATE SECRET 에 기본값을 넘기는 데만 쓴다(식을 직접 쓸 수 없다).
-- 값은 환경 변수에서만 읽는다. TEMPORARY 라 프로세스가 끝나면 사라진다.
-- 연결이 멈추면(방화벽, 프록시) .env 에 PGCONNECT_TIMEOUT 을 준다. libpq 가 직접 읽는다.
INSTALL postgres;
LOAD postgres;
SET VARIABLE pg_host     = coalesce(nullif(getenv('PG_HOST'), ''), '127.0.0.1');
SET VARIABLE pg_port     = coalesce(nullif(getenv('PG_PORT'), ''), '5432');
SET VARIABLE pg_database = coalesce(nullif(getenv('PG_DATABASE'), ''), 'gold');
SET VARIABLE pg_user     = coalesce(nullif(getenv('PG_USER'), ''), 'writer');
CREATE OR REPLACE TEMPORARY SECRET gold_pg (
  TYPE postgres,
  HOST     getvariable('pg_host'),
  PORT     getvariable('pg_port'),
  DATABASE getvariable('pg_database'),
  USER     getvariable('pg_user'),
  PASSWORD getenv('PG_PASSWORD')
);
-- 이 파일은 base.sql 보다 먼저 읽는다. base.sql 의 ATTACH IF NOT EXISTS 는 이미 붙은 gold 를 그대로 둔다.
ATTACH IF NOT EXISTS '' AS gold (TYPE postgres, SECRET gold_pg);
