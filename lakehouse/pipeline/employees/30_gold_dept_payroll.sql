-- silver.employee_snapshot(가장 늦은 스냅샷) → gold.dept_payroll(dt = 스냅샷 날짜)
-- 부서마다 인원, 성별 인원, 급여 합·평균·최소·최대, 부서장 이름. 급여가 없는 직원은 인원에만 센다.
.read pipeline/_init/base.sql
.read pipeline/_catalog/employees/silver.sql
.read pipeline/_catalog/employees/gold.sql
-- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
--   silver  읽기  silver.employees.employee_snapshot_latest()  가장 늦은 스냅샷의 직원
--   gold    쓰기  lake_path('gold.employees.dept_payroll')           부서 × 스냅샷 날짜(dt)

CREATE TEMP TABLE s AS FROM silver.employees.employee_snapshot_latest();  -- 아래에서 두 번 쓰므로 한 번만 읽는다

-- 쓸 결과: 부서 한 행. 부서장 이름은 같은 스냅샷의 직원 행에서 찾는다
CREATE TEMP TABLE dept_payroll AS
SELECT max(s.snapshot_at)                               AS snapshot_at,
       s.dept_no, s.dept_name,
       any_value(mgr.first_name || ' ' || mgr.last_name) AS manager_name,
       count(s.emp_no)                                  AS headcount,
       count(s.emp_no) FILTER (WHERE s.gender = 'F')    AS female,
       count(s.emp_no) FILTER (WHERE s.gender = 'M')    AS male,
       sum(s.salary)::BIGINT                            AS salary_total,
       round(avg(s.salary))::BIGINT                     AS salary_avg,
       min(s.salary)                                    AS salary_min,
       max(s.salary)                                    AS salary_max,
       strftime(max(s.snapshot_at), '%Y-%m-%d')         AS dt
FROM s
LEFT JOIN s mgr ON mgr.emp_no = s.dept_manager_emp_no
GROUP BY s.dept_no, s.dept_name;

COPY dept_payroll TO (lake_path('gold.employees.dept_payroll'))
  (FORMAT csv, HEADER true, PARTITION_BY (dt), OVERWRITE_OR_IGNORE true);

SELECT 'gold.employees.dept_payroll' AS written, count(*) AS rows, count(DISTINCT dt) AS partitions FROM dept_payroll;
