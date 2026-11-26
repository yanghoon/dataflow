-- bronze.employees 6개 표 → silver.employee_snapshot(dt, hr = 스냅샷)
-- 스냅샷(dt/hr)마다 표 6개가 모두 있는 실행 중 파일명이 가장 늦은 것 하나를 고른다(ADR-0005 B4).
-- 그 실행의 부서 ⟗ 소속(dept_emp)을 full join 하고, 직원·직급·급여·부서장을 붙인다(left join).
-- 한 행 = 직원 한 명. 직원이 없는 부서도 한 행으로 남는다(직원 열은 NULL).
.read pipelines/_shared/_init.sql
.read pipelines/employees_dept_payroll/_init.sql
.read pipelines/employees_dept_payroll/_catalog/bronze.sql
.read pipelines/employees_dept_payroll/_catalog/silver.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   bronze  읽기  bronze_employees_db_files()      브론즈 파일 목록(실행 고르기)
--   bronze  읽기  bronze_<표>()                    6개 표
--   silver  쓰기  silver_employee_snapshot_path()  직원 한 행, 스냅샷(dt, hr)별

-- 브론즈 파일 하나 = 한 행. 경로에서 표, dt, hr, 실행 이름을 뽑는다
CREATE TEMP TABLE files AS
SELECT file,
       regexp_extract(file, '/bronze/employees/([a-z_]+)/dt=', 1)                   AS tbl,
       regexp_extract(file, '/dt=([0-9]{4}-[0-9]{2}-[0-9]{2})/', 1)                  AS dt,
       regexp_extract(file, '/hr=([0-9]{2})/', 1)                                    AS hr,
       regexp_extract(file, '/([0-9]{8}T[0-9]{6}Z_[0-9A-Za-z]+)\.csv$', 1)           AS run
FROM bronze_employees_db_files();

-- 스냅샷(dt, hr)마다 고른 실행 하나
CREATE TEMP TABLE picked AS
SELECT dt, hr, run
FROM files
GROUP BY dt, hr, run
HAVING count(DISTINCT tbl) = 6
QUALIFY row_number() OVER (PARTITION BY dt, hr ORDER BY run DESC) = 1;

-- 표마다 고른 실행의 행만 남긴다(run 열을 붙인다). 브론즈는 모든 열이 문자열이고, 아래 SELECT 에서 타입을 바꾼다.
CREATE TEMP TABLE departments AS  -- 고른 실행의 부서
SELECT p.run, b.* EXCLUDE (filename) FROM bronze_departments() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE employees AS  -- 고른 실행의 직원
SELECT p.run, b.* EXCLUDE (filename) FROM bronze_employees() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE dept_emp AS  -- 고른 실행의 소속
SELECT p.run, b.* EXCLUDE (filename) FROM bronze_dept_emp() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE dept_manager AS  -- 고른 실행의 부서장
SELECT p.run, b.* EXCLUDE (filename) FROM bronze_dept_manager() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE titles AS  -- 고른 실행의 직급
SELECT p.run, b.* EXCLUDE (filename) FROM bronze_titles() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';
CREATE TEMP TABLE salaries AS  -- 고른 실행의 급여
SELECT p.run, b.* EXCLUDE (filename) FROM bronze_salaries() b JOIN picked p ON b.filename LIKE '%/' || p.run || '.csv';

-- 같은 실행 안에서 부서 ⟗ 소속, 직원·직급·급여·부서장을 붙이고 타입을 정한다
CREATE TEMP TABLE joined AS
SELECT coalesce(de.run, d.run)             AS run,
       coalesce(d.dept_no, de.dept_no)     AS dept_no,
       d.dept_name                         AS dept_name,
       m.emp_no::INTEGER                   AS dept_manager_emp_no,
       de.emp_no::INTEGER                  AS emp_no,
       e.first_name, e.last_name, e.gender,
       e.birth_date::DATE                  AS birth_date,
       e.hire_date::DATE                   AS hire_date,
       t.title                             AS title,
       s.salary::INTEGER                   AS salary
FROM departments d
FULL JOIN dept_emp de    ON de.run = d.run AND de.dept_no = d.dept_no
LEFT JOIN employees e    ON e.run = de.run AND e.emp_no = de.emp_no
LEFT JOIN titles t       ON t.run = de.run AND t.emp_no = de.emp_no
LEFT JOIN salaries s     ON s.run = de.run AND s.emp_no = de.emp_no
LEFT JOIN dept_manager m ON m.run = coalesce(de.run, d.run) AND m.dept_no = coalesce(d.dept_no, de.dept_no);

-- 쓸 결과: 스냅샷 시각, 브론즈 실행, 파티션 열(dt, hr)을 붙인다
CREATE TEMP TABLE employee_snapshot AS
SELECT strptime(p.dt || ' ' || p.hr, '%Y-%m-%d %H') AS snapshot_at,   -- 스냅샷 시각(UTC, 예정 시각)
       j.run                                      AS bronze_run,     -- 어느 브론즈 실행에서 왔는지
       j.* EXCLUDE (run),
       p.dt, p.hr                                                     -- 파티션 열(파일 안에는 없고 폴더 이름이 된다)
FROM joined j JOIN picked p USING (run);

COPY employee_snapshot TO (silver_employee_snapshot_path())
  (FORMAT csv, HEADER true, PARTITION_BY (dt, hr), OVERWRITE_OR_IGNORE true);

SELECT 'silver.employee_snapshot' AS written, count(*) AS rows, count(DISTINCT (dt, hr)) AS partitions FROM employee_snapshot;
