-- 카탈로그: gold.employees. 이름 규칙은 _catalog/jaffle_shop/bronze.sql 머리말과 같다.
-- dept_payroll: 한 행 = 스냅샷 날짜의 부서 하나. dt(스냅샷 날짜) 폴더별이고, dt 는 열이 아니다.
CREATE SCHEMA IF NOT EXISTS gold.employees;

CREATE OR REPLACE MACRO gold.employees.dept_payroll_types() AS {
  'snapshot_at': 'TIMESTAMP', 'dept_no': 'VARCHAR', 'dept_name': 'VARCHAR', 'manager_name': 'VARCHAR',
  'headcount': 'BIGINT', 'female': 'BIGINT', 'male': 'BIGINT',
  'salary_total': 'BIGINT', 'salary_avg': 'BIGINT', 'salary_min': 'INTEGER', 'salary_max': 'INTEGER'};

CREATE OR REPLACE MACRO gold.employees.dept_payroll(root := getvariable('root')) AS TABLE
  FROM lake_csv(lake_path('gold.employees.dept_payroll', root := root) || '/dt=*/*.csv', gold.employees.dept_payroll_types());
