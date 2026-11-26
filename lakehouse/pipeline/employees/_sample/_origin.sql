-- 로컬 시험용 원천: origin(MySQL employees). tier가 아니다. _sample/00_source.sql 만 읽는다. ADR lakehouse/0004.
-- 연결(ATTACH)이 필요해 _sample.sql 과 나눴다. 나머지 단계는 MySQL 없이 돌아야 한다.
-- 접속 값은 환경 변수로만 받는다(README 2장에서 셸에 만든다). 비밀은 TEMPORARY 라 프로세스가 끝나면 사라진다.
INSTALL mysql;
LOAD mysql;
-- CREATE SECRET 안에는 coalesce 같은 식을 쓸 수 없어 기본값을 변수로 먼저 정한다
SET VARIABLE emp_mysql_host = coalesce(nullif(getenv('EMP_MYSQL_HOST'), ''), '127.0.0.1');
SET VARIABLE emp_mysql_port = coalesce(nullif(getenv('EMP_MYSQL_PORT'), ''), '3306');
SET VARIABLE emp_mysql_user = coalesce(nullif(getenv('EMP_MYSQL_USER'), ''), 'reader');
CREATE OR REPLACE TEMPORARY SECRET emp_mysql (
  TYPE mysql,
  HOST     getvariable('emp_mysql_host'),
  PORT     getvariable('emp_mysql_port'),
  USER     getvariable('emp_mysql_user'),
  PASSWORD getenv('EMP_MYSQL_PASSWORD'),
  DATABASE 'employees'
);
ATTACH IF NOT EXISTS '' AS emp_origin (TYPE mysql, SECRET emp_mysql, READ_ONLY);

-- 읽기: 원천 표를 그대로. 타입은 MySQL 이 정한다(DATE, INT, ENUM → VARCHAR).
CREATE OR REPLACE MACRO origin_departments()  AS TABLE FROM emp_origin.employees.departments;
CREATE OR REPLACE MACRO origin_employees()    AS TABLE FROM emp_origin.employees.employees;
CREATE OR REPLACE MACRO origin_dept_emp()     AS TABLE FROM emp_origin.employees.dept_emp;
CREATE OR REPLACE MACRO origin_dept_manager() AS TABLE FROM emp_origin.employees.dept_manager;
CREATE OR REPLACE MACRO origin_titles()       AS TABLE FROM emp_origin.employees.titles;
CREATE OR REPLACE MACRO origin_salaries()     AS TABLE FROM emp_origin.employees.salaries;
