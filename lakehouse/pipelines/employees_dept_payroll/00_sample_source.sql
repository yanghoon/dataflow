-- origin(MySQL employees) → source.<표>(EMP_AS_OF_DAY 하루에 유효한 행만)
-- 이력 표(dept_emp, dept_manager, titles, salaries)는 from_date <= 날짜 < to_date 인 행만 남긴다(현재 행은 to_date = 9999-01-01).
-- 직원은 그날 부서에 속한 사람만, 부서는 전체. 열 이름과 값 표기(날짜 YYYY-MM-DD)는 원천 그대로 둔다.
-- MySQL 이 떠 있어야 한다(README 2장).
.read pipelines/_shared/_init.sql
.read pipelines/employees_dept_payroll/_init.sql
.read pipelines/employees_dept_payroll/_catalog/origin.sql
.read pipelines/employees_dept_payroll/_catalog/source.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   origin  읽기  origin_<표>()        MySQL employees 6개 표(departments, employees, dept_emp, dept_manager, titles, salaries)
--   source  쓰기  source_<표>_path()   스냅샷 날짜로 자른 6개 표

SET VARIABLE d = getvariable('emp_as_of_day');

CREATE TEMP TABLE dept_emp     AS FROM origin_dept_emp()     WHERE from_date <= getvariable('d') AND to_date > getvariable('d');  -- 그날의 소속
CREATE TEMP TABLE dept_manager AS FROM origin_dept_manager() WHERE from_date <= getvariable('d') AND to_date > getvariable('d');  -- 그날의 부서장
CREATE TEMP TABLE employees    AS FROM origin_employees()    WHERE emp_no IN (SELECT emp_no FROM dept_emp);                      -- 그날 재직자
CREATE TEMP TABLE titles       AS FROM origin_titles()
  WHERE from_date <= getvariable('d') AND to_date > getvariable('d') AND emp_no IN (SELECT emp_no FROM dept_emp);                -- 그날의 직급
CREATE TEMP TABLE salaries     AS FROM origin_salaries()
  WHERE from_date <= getvariable('d') AND to_date > getvariable('d') AND emp_no IN (SELECT emp_no FROM dept_emp);                -- 그날의 급여
CREATE TEMP TABLE departments  AS FROM origin_departments();                                                                     -- 부서 전체

COPY departments  TO (source_departments_path())  (FORMAT csv, HEADER true);
COPY employees    TO (source_employees_path())    (FORMAT csv, HEADER true);
COPY dept_emp     TO (source_dept_emp_path())     (FORMAT csv, HEADER true);
COPY dept_manager TO (source_dept_manager_path()) (FORMAT csv, HEADER true);
COPY titles       TO (source_titles_path())       (FORMAT csv, HEADER true);
COPY salaries     TO (source_salaries_path())     (FORMAT csv, HEADER true);

SELECT * FROM (VALUES
  ('source.departments',  (SELECT count(*) FROM departments)),
  ('source.employees',    (SELECT count(*) FROM employees)),
  ('source.dept_emp',     (SELECT count(*) FROM dept_emp)),
  ('source.dept_manager', (SELECT count(*) FROM dept_manager)),
  ('source.titles',       (SELECT count(*) FROM titles)),
  ('source.salaries',     (SELECT count(*) FROM salaries))
) v(written, rows);
