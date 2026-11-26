-- 카탈로그: silver.employees. 이름 규칙은 _catalog/jaffle_shop/bronze.sql 머리말과 같다.
-- employee_snapshot: 한 행 = 스냅샷 날짜에 재직 중인 직원 한 명(부서, 직급, 급여, 부서장).
-- 부서에 직원이 없으면 직원 열이 NULL인 한 행. dt, hr 는 폴더 이름이라 열이 아니다.
CREATE SCHEMA IF NOT EXISTS silver.employees;

CREATE OR REPLACE MACRO silver.employees.employee_snapshot_types() AS {
  'snapshot_at': 'TIMESTAMP', 'bronze_run': 'VARCHAR',
  'dept_no': 'VARCHAR', 'dept_name': 'VARCHAR', 'dept_manager_emp_no': 'INTEGER',
  'emp_no': 'INTEGER', 'first_name': 'VARCHAR', 'last_name': 'VARCHAR', 'gender': 'VARCHAR',
  'birth_date': 'DATE', 'hire_date': 'DATE', 'title': 'VARCHAR', 'salary': 'INTEGER'};

CREATE OR REPLACE MACRO silver.employees.employee_snapshot(root := getvariable('root')) AS TABLE
  FROM lake_csv(lake_path('silver.employees.employee_snapshot', root := root) || '/dt=*/hr=*/*.csv', silver.employees.employee_snapshot_types());

-- 골드와 검증이 함께 쓰는 기준: 가장 늦은 스냅샷 하나만 쓴다
CREATE OR REPLACE MACRO silver.employees.employee_snapshot_latest(root := getvariable('root')) AS TABLE
  FROM silver.employees.employee_snapshot(root := root) QUALIFY snapshot_at = max(snapshot_at) OVER ();
