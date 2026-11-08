-- compose postgres 초기화(볼륨이 비어 있을 때 처음 한 번만 돈다). ADR: docs/adr/airbyte/0005
--   kestra        Kestra 메타DB(POSTGRES_DB로 생성됨)
--   source_users  PG 수집 시험 소스(운영에서는 KV PG_URL만 사내 PG로 바꾼다)
--   ingest_ops    감시 흐름이 남기는 실행 결과 표

CREATE DATABASE source_users;
CREATE DATABASE ingest_ops;

\connect source_users
CREATE TABLE users (
  id            bigint PRIMARY KEY,
  username      text NOT NULL,
  email         text,          -- 10번째마다 NULL
  display_name  text,          -- 7번째마다 빈 문자열('')
  created_at    timestamptz NOT NULL,
  last_login_at timestamptz
);
INSERT INTO users
SELECT g,
       'user' || g,
       CASE WHEN g % 10 = 0 THEN NULL ELSE 'user' || g || '@example.com' END,
       CASE WHEN g % 7 = 0 THEN '' ELSE 'User ' || g END,
       timestamptz '2024-01-01 00:00:00+00' + g * interval '1 hour',
       CASE WHEN g % 3 = 0 THEN NULL ELSE timestamptz '2026-11-01 00:00:00+00' + g * interval '1 minute' END
FROM generate_series(1, 500) AS g;

\connect ingest_ops
CREATE TABLE ingest_run_status (
  execution_id text PRIMARY KEY,
  flow_id      text        NOT NULL,
  scheduled_at timestamptz,
  state        text        NOT NULL,
  ended_at     timestamptz NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ingest_run_status (flow_id, scheduled_at);
