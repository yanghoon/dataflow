-- 카탈로그: bronze.employees(수집 결과, 원본 형식 그대로). 이름 규칙은 _catalog/jaffle_shop/bronze.sql 머리말과 같다.
-- 폴더 규칙은 jaffle_shop 과 같다: <표>/dt=/hr=/<실행 시각>_<실행 ID>.csv. 쓰기는 lake_path('bronze.employees.<표>') 하나다.
CREATE SCHEMA IF NOT EXISTS bronze.employees;

CREATE OR REPLACE MACRO bronze.employees.departments_types()  AS {'dept_no': 'VARCHAR', 'dept_name': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.employees.employees_types()    AS {'emp_no': 'VARCHAR', 'birth_date': 'VARCHAR', 'first_name': 'VARCHAR', 'last_name': 'VARCHAR',
                                                                  'gender': 'VARCHAR', 'hire_date': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.employees.dept_emp_types()     AS {'emp_no': 'VARCHAR', 'dept_no': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.employees.dept_manager_types() AS {'emp_no': 'VARCHAR', 'dept_no': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.employees.titles_types()       AS {'emp_no': 'VARCHAR', 'title': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE OR REPLACE MACRO bronze.employees.salaries_types()     AS {'emp_no': 'VARCHAR', 'salary': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};

-- schema 안 모든 표의 브론즈 파일 목록(실행 고르기, 검증)
CREATE OR REPLACE MACRO bronze.employees.files(root := getvariable('root')) AS TABLE
  FROM glob(lake_path('bronze.employees', root := root) || '/*/dt=*/hr=*/*.csv');

CREATE OR REPLACE MACRO bronze.employees.departments(root := getvariable('root'))  AS TABLE FROM lake_csv_with_file(lake_path('bronze.employees.departments', root := root)  || '/dt=*/hr=*/*.csv', bronze.employees.departments_types());
CREATE OR REPLACE MACRO bronze.employees.employees(root := getvariable('root'))    AS TABLE FROM lake_csv_with_file(lake_path('bronze.employees.employees', root := root)    || '/dt=*/hr=*/*.csv', bronze.employees.employees_types());
CREATE OR REPLACE MACRO bronze.employees.dept_emp(root := getvariable('root'))     AS TABLE FROM lake_csv_with_file(lake_path('bronze.employees.dept_emp', root := root)     || '/dt=*/hr=*/*.csv', bronze.employees.dept_emp_types());
CREATE OR REPLACE MACRO bronze.employees.dept_manager(root := getvariable('root')) AS TABLE FROM lake_csv_with_file(lake_path('bronze.employees.dept_manager', root := root) || '/dt=*/hr=*/*.csv', bronze.employees.dept_manager_types());
CREATE OR REPLACE MACRO bronze.employees.titles(root := getvariable('root'))       AS TABLE FROM lake_csv_with_file(lake_path('bronze.employees.titles', root := root)       || '/dt=*/hr=*/*.csv', bronze.employees.titles_types());
CREATE OR REPLACE MACRO bronze.employees.salaries(root := getvariable('root'))     AS TABLE FROM lake_csv_with_file(lake_path('bronze.employees.salaries', root := root)     || '/dt=*/hr=*/*.csv', bronze.employees.salaries_types());
