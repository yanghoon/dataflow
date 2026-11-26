-- 로컬 시험용 원본: source(스냅샷 날짜 하루 기준으로 자른 MySQL 표). tier가 아니다. 이름 규칙은 jaffle_shop/_sample/_sample.sql 머리말과 같다.
-- 원본 형식을 바꾸지 않으므로 모든 열은 문자열로 읽는다(날짜는 YYYY-MM-DD).

CREATE OR REPLACE MACRO source_departments_types()  AS {'dept_no': 'VARCHAR', 'dept_name': 'VARCHAR'};
CREATE OR REPLACE MACRO source_employees_types()    AS {'emp_no': 'VARCHAR', 'birth_date': 'VARCHAR', 'first_name': 'VARCHAR', 'last_name': 'VARCHAR',
                                             'gender': 'VARCHAR', 'hire_date': 'VARCHAR'};
CREATE OR REPLACE MACRO source_dept_emp_types()     AS {'emp_no': 'VARCHAR', 'dept_no': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE OR REPLACE MACRO source_dept_manager_types() AS {'emp_no': 'VARCHAR', 'dept_no': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE OR REPLACE MACRO source_titles_types()       AS {'emp_no': 'VARCHAR', 'title': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE OR REPLACE MACRO source_salaries_types()     AS {'emp_no': 'VARCHAR', 'salary': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};

CREATE OR REPLACE MACRO source_departments_path(root := getvariable('source_root'))  AS root || '/employees/departments.csv';
CREATE OR REPLACE MACRO source_employees_path(root := getvariable('source_root'))    AS root || '/employees/employees.csv';
CREATE OR REPLACE MACRO source_dept_emp_path(root := getvariable('source_root'))     AS root || '/employees/dept_emp.csv';
CREATE OR REPLACE MACRO source_dept_manager_path(root := getvariable('source_root')) AS root || '/employees/dept_manager.csv';
CREATE OR REPLACE MACRO source_titles_path(root := getvariable('source_root'))       AS root || '/employees/titles.csv';
CREATE OR REPLACE MACRO source_salaries_path(root := getvariable('source_root'))     AS root || '/employees/salaries.csv';

CREATE OR REPLACE MACRO source_departments(root := getvariable('source_root'))  AS TABLE FROM lake_csv(source_departments_path(root := root),  source_departments_types());
CREATE OR REPLACE MACRO source_employees(root := getvariable('source_root'))    AS TABLE FROM lake_csv(source_employees_path(root := root),    source_employees_types());
CREATE OR REPLACE MACRO source_dept_emp(root := getvariable('source_root'))     AS TABLE FROM lake_csv(source_dept_emp_path(root := root),     source_dept_emp_types());
CREATE OR REPLACE MACRO source_dept_manager(root := getvariable('source_root')) AS TABLE FROM lake_csv(source_dept_manager_path(root := root), source_dept_manager_types());
CREATE OR REPLACE MACRO source_titles(root := getvariable('source_root'))       AS TABLE FROM lake_csv(source_titles_path(root := root),       source_titles_types());
CREATE OR REPLACE MACRO source_salaries(root := getvariable('source_root'))     AS TABLE FROM lake_csv(source_salaries_path(root := root),     source_salaries_types());
