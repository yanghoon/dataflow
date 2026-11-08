"""브론즈 파일 규칙을 실버(DuckDB) 쪽에서 확인한다. ADR-0005 B4, 검증 7·14.
  uvx --with duckdb python verify/silver_check.py
결과를 출력하고, 기대와 다르면 종료 코드 1.
"""
import os
import sys

import duckdb

ENDPOINT = os.environ.get("S3_ENDPOINT_HOSTPORT", "localhost:8333")
c = duckdb.connect()
c.sql("INSTALL httpfs; LOAD httpfs;")
c.sql(f"""CREATE SECRET (TYPE s3, KEY_ID 'dataflow', SECRET 'dataflow-secret', ENDPOINT '{ENDPOINT}',
          URL_STYLE 'path', USE_SSL false, REGION 'us-east-1')""")
ok = True

# B4: 시간대별로 스트림 3개가 모두 있는 실행 중 파일명(run_ts)이 가장 큰 것 하나
c.sql(r"""
CREATE TABLE picked AS
WITH f AS (
  SELECT file,
         regexp_extract(file, 'bronze/gerrit/([a-z]+)/', 1)                     AS stream,
         regexp_extract(file, '/dt=([0-9-]+)/', 1)                               AS dt,
         regexp_extract(file, '/hr=([0-9]+)/', 1)                                AS hr,
         regexp_extract(file, '/([0-9]{8}T[0-9]{6}Z)_([0-9A-Za-z]+)\.jsonl$', 1) AS run_ts,
         regexp_extract(file, '/([0-9]{8}T[0-9]{6}Z)_([0-9A-Za-z]+)\.jsonl$', 2) AS execution_id
  FROM glob('s3://dataflow-bronze/bronze/gerrit/*/dt=*/hr=*/*.jsonl')
), runs AS (
  SELECT dt, hr, run_ts, execution_id, count(DISTINCT stream) AS streams FROM f GROUP BY ALL
)
SELECT dt, hr, run_ts, execution_id FROM runs WHERE streams = 3
QUALIFY row_number() OVER (PARTITION BY dt, hr ORDER BY run_ts DESC, execution_id DESC) = 1
""")
print("== B4 선택된 스냅샷")
c.sql("SELECT * FROM picked ORDER BY dt, hr").show()
if c.execute("SELECT count(*) FROM picked WHERE execution_id LIKE 'PARTIAL%'").fetchone()[0]:
    print("FAIL: 스트림이 빠진 실행이 선택됨"); ok = False

# 14: read_json + hive 파티션 + filename 열로 선택된 실행만 읽기
print("== 14 read_json filename 열")
rows = c.execute(r"""
SELECT a.dt, a.hr, count(*) AS accounts
FROM read_json('s3://dataflow-bronze/bronze/gerrit/account/dt=*/hr=*/*.jsonl', hive_partitioning = true, filename = true) a
JOIN picked p ON p.dt = CAST(a.dt AS VARCHAR) AND p.hr = lpad(CAST(a.hr AS VARCHAR), 2, '0')
             AND a.filename LIKE '%' || p.execution_id || '.jsonl'
GROUP BY ALL ORDER BY ALL
""").fetchall()
print(rows)
expected = c.execute("SELECT count(*) FROM picked").fetchone()[0]
if len(rows) != expected or any(r[2] != 250 for r in rows):
    print("FAIL: 선택된 Account 스냅샷 건수가 250이 아님"); ok = False

# 7: PG CSV의 NULL(따옴표 없는 빈 값)과 빈 문자열("")을 구분해 읽기. allow_quoted_nulls=false 가 필요하다
print("== 7 CSV NULL / 빈 문자열")
got = dict((r[0], r[1:]) for r in c.execute(r"""
SELECT id, email IS NULL, display_name IS NULL, display_name = ''
FROM read_csv('s3://dataflow-bronze/bronze/pg/users/dt=*/hr=*/*.csv', header = true, all_varchar = true,
              allow_quoted_nulls = false)
WHERE id IN ('7', '10') QUALIFY row_number() OVER (PARTITION BY id) = 1
""").fetchall())
print(got)
if got.get("7") != (False, False, True) or got.get("10") != (True, False, False):
    print("FAIL: NULL과 빈 문자열이 구분되지 않음"); ok = False

sys.exit(0 if ok else 1)
