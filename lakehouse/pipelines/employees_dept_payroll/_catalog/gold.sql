-- 층별 카탈로그: gold. dept_payroll: 한 행 = 스냅샷 날짜의 부서 하나. dt(스냅샷 날짜) 폴더별이고, dt 는 열이 아니다.

CREATE MACRO gold_dept_payroll_types() AS {
  'snapshot_at': 'TIMESTAMP', 'dept_no': 'VARCHAR', 'dept_name': 'VARCHAR', 'manager_name': 'VARCHAR',
  'headcount': 'BIGINT', 'female': 'BIGINT', 'male': 'BIGINT',
  'salary_total': 'BIGINT', 'salary_avg': 'BIGINT', 'salary_min': 'INTEGER', 'salary_max': 'INTEGER'};

CREATE MACRO gold_dept_payroll_path(root := getvariable('root')) AS root || '/gold/employees/dept_payroll';
CREATE MACRO gold_dept_payroll(root := getvariable('root')) AS TABLE
  FROM lake_csv(gold_dept_payroll_path(root := root) || '/dt=*/*.csv', gold_dept_payroll_types());
