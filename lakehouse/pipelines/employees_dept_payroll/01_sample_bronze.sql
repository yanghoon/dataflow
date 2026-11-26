-- 로컬 전용 브론즈 샘플. source 6개 표를 한 번 전체 수집한 것처럼 스냅샷 하나로 쓴다(나누지 않는다).
-- dt = EMP_AS_OF_DAY, hr = 00. 파일 이름 = <실행 시각 dt 00:05>_sim<YYYYMMDD>00 (ADR-0005 B1·B2와 같은 꼴).
-- DuckDB COPY 는 없는 폴더를 만들지 않으므로, jaffle_shop_sales/01 과 같이 폴더 만들기와 COPY 문을
-- build/employees_bronze_local_sample.sql 에 쓰고 .read 로 실행한다.
-- 보안: 로컬 전용이다. 경로 값(DATA_ROOT)을 검사 없이 셸과 SQL에 그대로 넘긴다.
.read pipelines/_shared/_init.sql
.read pipelines/employees_dept_payroll/_init.sql
.read pipelines/employees_dept_payroll/_catalog/source.sql
.read pipelines/employees_dept_payroll/_catalog/bronze.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   source  읽기  source_<표>()        시험용 원본 6개 표. 아래에서 문자열로 이름을 만들어 부른다
--   bronze  쓰기  bronze_<표>_path()   브론즈 표 폴더(<표>/dt=/hr=/<실행>.csv)
.shell mkdir -p build

-- 만들 브론즈 파일 하나 = 표 하나(스냅샷은 하나)
CREATE TEMP TABLE plan AS
SELECT tbl,
       t,
       dir_root || '/dt=' || strftime(t, '%Y-%m-%d') || '/hr=' || strftime(t, '%H') AS dir,
       strftime(t + INTERVAL 5 MINUTE, '%Y%m%dT%H%M%SZ') || '_sim' || strftime(t, '%Y%m%d%H') AS run
FROM (SELECT getvariable('emp_as_of_day')::TIMESTAMP AS t) s,
     (VALUES ('departments',  bronze_departments_path()),
             ('employees',    bronze_employees_path()),
             ('dept_emp',     bronze_dept_emp_path()),
             ('dept_manager', bronze_dept_manager_path()),
             ('titles',       bronze_titles_path()),
             ('salaries',     bronze_salaries_path())) v(tbl, dir_root);

.mode list
.headers off
.once build/employees_bronze_local_sample.sql
SELECT line FROM (
  SELECT dir, 0 AS ord, '.shell mkdir -p ' || dir AS line FROM plan
  UNION ALL
  SELECT dir, 1, 'COPY (FROM source_' || tbl || '()) TO ''' || dir || '/' || run || '.csv'' (FORMAT csv, HEADER true);' FROM plan
) ORDER BY dir, ord;
.read build/employees_bronze_local_sample.sql
.mode duckbox
.headers on
SELECT 'bronze.employees' AS written, count(*) AS files, count(DISTINCT run) AS snapshots, min(t) AS snapshot FROM plan;
