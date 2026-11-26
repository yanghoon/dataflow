-- tier 사이 숫자가 맞는지 본다. 시험용 원본 없이 돈다(정기 실행에 넣는다). ok 열이 모두 true 여야 한다.
-- 원본과 비교하는 검사는 _sample/90_checks.sql 에 있다.
.read pipeline/_init/base.sql
.read pipeline/_catalog/employees/silver.sql
.read pipeline/_catalog/employees/gold.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   silver  읽기  silver.employees.employee_snapshot_latest()  가장 늦은 스냅샷
--   gold    읽기  gold.employees.dept_payroll()                골드 부서

CREATE TEMP TABLE silver_last AS FROM silver.employees.employee_snapshot_latest();  -- 실버 가장 늦은 스냅샷
CREATE TEMP TABLE gold        AS FROM gold.employees.dept_payroll();                -- 골드 부서

SELECT check_name, expected, actual, expected = actual AS ok FROM (VALUES
  ('silver: 직원은 한 번만 나옴',
     (SELECT count(emp_no) FROM silver_last),
     (SELECT count(DISTINCT emp_no) FROM silver_last)),
  ('gold: 인원 합 = silver 직원 행',
     (SELECT count(emp_no) FROM silver_last),
     (SELECT sum(headcount)::BIGINT FROM gold))
) v(check_name, expected, actual);
