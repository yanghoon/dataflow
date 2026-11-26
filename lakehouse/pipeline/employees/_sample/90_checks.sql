-- 로컬 시험: 시험용 원본(source)과 각 tier의 숫자가 맞는지 본다. ok 열이 모두 true 여야 한다. MySQL 없이 돈다.
-- 실제 파이프라인(20~30)과 ../90_checks.sql 다음에 돌린다:
--   pipeline/run.sh pipeline/employees/_sample/01_bronze.sql pipeline/employees/*.sql pipeline/employees/_sample/9*.sql
.read pipeline/_init/base.sql
.read pipeline/employees/_sample/_sample.sql
.read pipeline/_catalog/employees/bronze.sql
.read pipeline/_catalog/employees/silver.sql
.read pipeline/_catalog/employees/gold.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   source  읽기  source_departments(), source_dept_emp(), source_salaries()  기준이 되는 시험용 원본
--   bronze  읽기  bronze.employees.files()                                 브론즈 파일 수
--   silver  읽기  silver.employees.employee_snapshot(), silver.employees.employee_snapshot_latest()  모든 스냅샷, 가장 늦은 스냅샷
--   gold    읽기  gold.employees.dept_payroll()                                         골드 합계

CREATE TEMP TABLE src_depts    AS FROM source_departments();             -- 원본 부서
CREATE TEMP TABLE src_dept_emp AS FROM source_dept_emp();                -- 원본 소속(스냅샷 날짜)
CREATE TEMP TABLE src_salaries AS FROM source_salaries();                -- 원본 급여(스냅샷 날짜)
CREATE TEMP TABLE bronze_files AS FROM bronze.employees.files();      -- 브론즈 파일 목록
CREATE TEMP TABLE silver       AS FROM silver.employees.employee_snapshot();       -- 실버 모든 스냅샷
CREATE TEMP TABLE silver_last  AS FROM silver.employees.employee_snapshot_latest(); -- 실버 가장 늦은 스냅샷
CREATE TEMP TABLE gold         AS FROM gold.employees.dept_payroll();              -- 골드 부서

SET VARIABLE d = getvariable('emp_as_of_day');

SELECT check_name, expected, actual, expected = actual AS ok FROM (VALUES
  ('source: 소속이 모두 스냅샷 날짜에 유효함',
     0::BIGINT,
     (SELECT count(*) FROM src_dept_emp WHERE NOT (from_date::DATE <= getvariable('d') AND to_date::DATE > getvariable('d')))),
  ('bronze: 파일 수 = 표 6개(스냅샷 1개)',
     6::BIGINT,
     (SELECT count(*) FROM bronze_files)),
  ('silver: 스냅샷 수 = 1',
     1::BIGINT,
     (SELECT count(DISTINCT snapshot_at) FROM silver)),
  ('silver: 직원 행 = 원본 소속 행',
     (SELECT count(*) FROM src_dept_emp),
     (SELECT count(emp_no) FROM silver_last)),
  ('silver: 부서 수 = 원본 부서',
     (SELECT count(*) FROM src_depts),
     (SELECT count(DISTINCT dept_no) FROM silver_last)),
  ('gold: 급여 합 = 원본 급여 합',
     (SELECT sum(salary::BIGINT) FROM src_salaries),
     (SELECT sum(salary_total)::BIGINT FROM gold))
) v(check_name, expected, actual);
