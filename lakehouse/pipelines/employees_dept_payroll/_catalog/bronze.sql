-- 층별 카탈로그: bronze(수집 결과, 원본 형식 그대로). 폴더 규칙은 jaffle_shop_sales 와 같다: <표>/dt=/hr=/<실행 시각>_<실행 ID>.csv
-- 표 이름 employees 가 스키마 이름과 같아, 스키마 단위 macro(jaffle 의 bronze_jaffle_shop_path)를 두면
-- bronze_employees_path 가 표 macro 와 겹친다. 그래서 쓰기 경로도 표마다 두고, 파일 목록만 스키마 단위로 둔다(ADR lakehouse/0004).

CREATE MACRO bronze_departments_types()  AS {'dept_no': 'VARCHAR', 'dept_name': 'VARCHAR'};
CREATE MACRO bronze_employees_types()    AS {'emp_no': 'VARCHAR', 'birth_date': 'VARCHAR', 'first_name': 'VARCHAR', 'last_name': 'VARCHAR',
                                             'gender': 'VARCHAR', 'hire_date': 'VARCHAR'};
CREATE MACRO bronze_dept_emp_types()     AS {'emp_no': 'VARCHAR', 'dept_no': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE MACRO bronze_dept_manager_types() AS {'emp_no': 'VARCHAR', 'dept_no': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE MACRO bronze_titles_types()       AS {'emp_no': 'VARCHAR', 'title': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};
CREATE MACRO bronze_salaries_types()     AS {'emp_no': 'VARCHAR', 'salary': 'VARCHAR', 'from_date': 'VARCHAR', 'to_date': 'VARCHAR'};

CREATE MACRO bronze_departments_path(root := getvariable('root'))  AS root || '/bronze/employees/departments';
CREATE MACRO bronze_employees_path(root := getvariable('root'))    AS root || '/bronze/employees/employees';
CREATE MACRO bronze_dept_emp_path(root := getvariable('root'))     AS root || '/bronze/employees/dept_emp';
CREATE MACRO bronze_dept_manager_path(root := getvariable('root')) AS root || '/bronze/employees/dept_manager';
CREATE MACRO bronze_titles_path(root := getvariable('root'))       AS root || '/bronze/employees/titles';
CREATE MACRO bronze_salaries_path(root := getvariable('root'))     AS root || '/bronze/employees/salaries';

CREATE MACRO bronze_employees_db_files(root := getvariable('root')) AS TABLE
  FROM glob(root || '/bronze/employees/*/dt=*/hr=*/*.csv');

CREATE MACRO bronze_departments(root := getvariable('root'))  AS TABLE FROM lake_csv_with_file(bronze_departments_path(root := root)  || '/dt=*/hr=*/*.csv', bronze_departments_types());
CREATE MACRO bronze_employees(root := getvariable('root'))    AS TABLE FROM lake_csv_with_file(bronze_employees_path(root := root)    || '/dt=*/hr=*/*.csv', bronze_employees_types());
CREATE MACRO bronze_dept_emp(root := getvariable('root'))     AS TABLE FROM lake_csv_with_file(bronze_dept_emp_path(root := root)     || '/dt=*/hr=*/*.csv', bronze_dept_emp_types());
CREATE MACRO bronze_dept_manager(root := getvariable('root')) AS TABLE FROM lake_csv_with_file(bronze_dept_manager_path(root := root) || '/dt=*/hr=*/*.csv', bronze_dept_manager_types());
CREATE MACRO bronze_titles(root := getvariable('root'))       AS TABLE FROM lake_csv_with_file(bronze_titles_path(root := root)       || '/dt=*/hr=*/*.csv', bronze_titles_types());
CREATE MACRO bronze_salaries(root := getvariable('root'))     AS TABLE FROM lake_csv_with_file(bronze_salaries_path(root := root)     || '/dt=*/hr=*/*.csv', bronze_salaries_types());
