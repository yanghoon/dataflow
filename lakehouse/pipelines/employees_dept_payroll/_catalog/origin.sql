-- 층별 카탈로그: origin(원천 MySQL employees). 00번만 읽는다. ADR lakehouse/0004.
-- 다른 층과 달리 연결(ATTACH)이 필요해 source.sql 과 나눴다. 90번 등은 MySQL 없이 돌아야 한다.
-- 접속 값은 환경 변수로만 받는다(README 2장에서 셸에 만든다). 비밀은 TEMPORARY 라 프로세스가 끝나면 사라진다.
INSTALL mysql;
LOAD mysql;
-- CREATE SECRET 안에는 coalesce 같은 식을 쓸 수 없어 기본값을 변수로 먼저 정한다
SET VARIABLE emp_mysql_host = coalesce(nullif(getenv('EMP_MYSQL_HOST'), ''), '127.0.0.1');
SET VARIABLE emp_mysql_port = coalesce(nullif(getenv('EMP_MYSQL_PORT'), ''), '3306');
SET VARIABLE emp_mysql_user = coalesce(nullif(getenv('EMP_MYSQL_USER'), ''), 'reader');
CREATE TEMPORARY SECRET emp_mysql (
  TYPE mysql,
  HOST     getvariable('emp_mysql_host'),
  PORT     getvariable('emp_mysql_port'),
  USER     getvariable('emp_mysql_user'),
  PASSWORD getenv('EMP_MYSQL_PASSWORD'),
  DATABASE 'employees'
);
ATTACH '' AS emp_origin (TYPE mysql, SECRET emp_mysql, READ_ONLY);

-- 읽기: 원천 표를 그대로. 타입은 MySQL 이 정한다(DATE, INT, ENUM → VARCHAR).
CREATE MACRO origin_departments()  AS TABLE FROM emp_origin.employees.departments;
CREATE MACRO origin_employees()    AS TABLE FROM emp_origin.employees.employees;
CREATE MACRO origin_dept_emp()     AS TABLE FROM emp_origin.employees.dept_emp;
CREATE MACRO origin_dept_manager() AS TABLE FROM emp_origin.employees.dept_manager;
CREATE MACRO origin_titles()       AS TABLE FROM emp_origin.employees.titles;
CREATE MACRO origin_salaries()     AS TABLE FROM emp_origin.employees.salaries;
