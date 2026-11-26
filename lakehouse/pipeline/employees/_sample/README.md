# employees: MySQL employees → bronze → silver → gold

## 0. 무엇을 만드나

MySQL 예제 DB `employees`(datacharmer/test_db)를 원천 시스템으로 두고, 하루(`EMP_AS_OF_DAY`, 기본 2000-01-01)의 상태를 잘라 브론즈, 실버, 골드를 만든다. 브론즈는 스냅샷 하나(나누지 않음)이고, 골드는 부서별 인원·급여 집계다.
두 번째 파이프라인으로서 `_shared/`와 카탈로그 규칙에 주는 영향을 확인하는 것도 목적이다(8장, ADR lakehouse/0004).
**상태: 로컬 디스크에서 2~6을 실행해 검증 8개가 모두 통과했다(2026-11-17).** 같은 때 `jaffle_shop_sales` 20~90도 다시 돌려 검증 10개가 통과했다. S3(`s3://local`)와 Kestra 호출은 실행하지 않았다.

```
lakehouse/
  source/employees/<표>.csv                      스냅샷 날짜로 자른 원본
  s3-local/
    bronze/employees/<표>/dt=YYYY-MM-DD/hr=00/<실행 시각>_<실행 ID>.csv
    silver/employees/employee_snapshot/dt=YYYY-MM-DD/hr=00/data_0.csv
    gold/employees/dept_payroll/dt=YYYY-MM-DD/data_0.csv
  pipeline/_catalog/employees/{bronze,silver,gold}.sql   표 선언(bronze.employees.<표>() 등)
  pipeline/employees/
    20_silver_employee_snapshot.sql  30_gold_dept_payroll.sql  90_checks.sql
    _sample/_origin.sql                            MySQL 연결과 원천 표(00만 읽음)
    _sample/_sample.sql                            시험용 원본(source) 표
    _sample/00_source.sql  01_bronze.sql  90_checks.sql
```

로컬에 남는 것은 `source/`, `s3-local/` 아래 CSV뿐이다. test_db와 MySQL 데이터는 컨테이너의 tmpfs(메모리)에만 있어 컨테이너를 멈추면 사라진다.

## 1. 준비

DuckDB CLI(설치는 `lakehouse/README.md` 1장), Docker, `openssl`. 모든 명령은 `lakehouse/`에서 같은 셸로 실행한다. 스냅샷 날짜(`EMP_AS_OF_DAY`)와 MySQL 접속 값은 `pipeline/.env`에 둔다(목록: `pipeline/.env.example`). 비밀번호는 `.env`에 두지 않고 2장처럼 셸에서 만든다.

```bash
cd lakehouse
E=pipeline/employees
```

## 2. 소스 만들기 (원천 MySQL → `00_sample_source.sql`)

```bash
# 비밀번호: 이 셸의 환경 변수에만 둔다(파일, 명령줄에 남기지 않는다)
export MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16) EMP_MYSQL_PASSWORD=$(openssl rand -hex 16)

# 원천 MySQL 띄우기. DB 데이터와 /tmp 는 메모리(tmpfs), 멈추면 컨테이너째 사라진다(--rm). 메모리 약 500MiB
docker run -d --rm --name lakehouse-employees-mysql \
  -e MYSQL_ROOT_PASSWORD -e EMP_MYSQL_PASSWORD \
  --tmpfs /var/lib/mysql --tmpfs /tmp \
  -p 127.0.0.1:${EMP_MYSQL_PORT:-3306}:3306 mysql:8.4
until docker exec lakehouse-employees-mysql sh -c 'mysqladmin ping -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' 2>/dev/null; do sleep 2; done

# test_db 내려받아 적재. 컨테이너 안 /tmp 에 풀고 적재 뒤 지운다
docker exec lakehouse-employees-mysql sh -c 'set -e; mkdir /tmp/test_db; cd /tmp/test_db
  curl -fsSL https://github.com/datacharmer/test_db/archive/refs/heads/master.tar.gz | tar -xz --strip-components=1
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < employees.sql; cd /; rm -rf /tmp/test_db'

# 00번이 쓰는 읽기 전용 계정(reader). 비밀번호는 표준 입력으로 넘긴다
docker exec -i lakehouse-employees-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' \
  <<< "CREATE USER reader IDENTIFIED BY '$EMP_MYSQL_PASSWORD'; GRANT SELECT ON employees.* TO reader;"

# 소스 CSV 쓰기
mkdir -p source/employees
pipeline/run.sh $E/_sample/00_source.sql

# 원천 내리기. 컨테이너, DB, 내려받은 파일이 모두 사라진다
docker stop lakehouse-employees-mysql
```

실측(2026-11-17): 띄우기부터 00번까지 약 70초.

- DuckDB `mysql` 확장으로 원천을 `ATTACH`(읽기 전용)하고, 비밀은 `TEMPORARY SECRET`이라 프로세스가 끝나면 사라진다.
- 자르는 규칙: 이력 표(`dept_emp`, `dept_manager`, `titles`, `salaries`)는 `from_date <= 날짜 < to_date`인 행만, 직원은 그날 부서에 속한 사람만, 부서는 전체.
- 원본 형식을 바꾸지 않는다. 열 이름은 MySQL 그대로, 날짜는 `YYYY-MM-DD`.

| 표 | 열 | 2000-01-01 행 수 |
|---|---|---|
| `departments` | `dept_no`, `dept_name` | 9 |
| `employees` | `emp_no`, `birth_date`, `first_name`, `last_name`, `gender`, `hire_date` | 257,293 |
| `dept_emp` | `emp_no`, `dept_no`, `from_date`, `to_date` | 257,293 |
| `dept_manager` | `emp_no`, `dept_no`, `from_date`, `to_date` | 9 |
| `titles` | `emp_no`, `title`, `from_date`, `to_date` | 257,293 |
| `salaries` | `emp_no`, `salary`, `from_date`, `to_date` | 257,293 |

## 3. 브론즈 만들기 (`01_sample_bronze.sql`)

```bash
pipeline/run.sh $E/_sample/01_bronze.sql
```

- source 6개 표를 한 번 전체 수집한 것처럼 스냅샷 하나로 쓴다. `dt` = `EMP_AS_OF_DAY`, `hr` = `00`, 파일 이름 = `20000101T000500Z_sim2000010100.csv`.
- 폴더와 파일 이름 규칙은 `jaffle_shop`과 같다(ADR-0005 B1~B7). 나중에 실제 수집이 같은 규칙으로 쓰면 이 단계를 뺀다.

## 4. 실버 만들기 (`20_silver_employee_snapshot.sql`)

```bash
mkdir -p s3-local/silver/employees s3-local/gold/employees   # 로컬 디스크만. DuckDB가 상위 폴더를 만들지 않는다
pipeline/run.sh $E/20_silver_employee_snapshot.sql
```

- 한 행 = 스냅샷 날짜에 재직 중인 직원 한 명. 부서 ⟗ 소속은 full join, 직원·직급·급여·부서장은 left join. 직원 없는 부서는 직원 열이 NULL인 한 행.
- 열: `snapshot_at`, `bronze_run`, `dept_no`, `dept_name`, `dept_manager_emp_no`, `emp_no`, `first_name`, `last_name`, `gender`, `birth_date`, `hire_date`, `title`, `salary`.
- 스냅샷마다 표 6개가 모두 있는 실행 중 가장 늦은 것 하나를 쓴다(B4).

## 5. 골드 만들기 (`30_gold_dept_payroll.sql`)

```bash
pipeline/run.sh $E/30_gold_dept_payroll.sql
```

- 한 행 = 부서 하나. `headcount`, `female`, `male`, `salary_total`, `salary_avg`, `salary_min`, `salary_max`, `manager_name`. `dt` = 스냅샷 날짜.

## 6. 검증하기 (`90_checks.sql`)

```bash
pipeline/run.sh $E/90_checks.sql $E/_sample/90_checks.sql     # MySQL 없이 돈다. ok 열이 모두 true
```

소속이 날짜에 유효한지, 브론즈 파일 수(6), 스냅샷 수(1), 실버 직원 행 = 원본 소속, 직원 중복 없음, 부서 수, 골드 인원 합, 골드 급여 합 = 원본 급여 합(17,133,967,926)을 비교한다.

실측(2026-11-17, 2000-01-01):

| 층 | 크기 | 건수 |
|---|---|---|
| source | 38MB | 위 표 |
| bronze | 38MB | CSV 6개 |
| silver | 34MB | 257,293행 |
| gold | 4KB | 부서 9행 |

## 7. 결과 열어 보기, 다시 만들기

```bash
duckdb -c "SELECT * FROM read_csv('s3-local/gold/employees/dept_payroll/dt=*/*.csv') ORDER BY headcount DESC"
rm -rf source/employees s3-local/*/employees    # 처음부터 다시 만들 때
```

| 환경 변수 | 기본값 | 뜻 |
|---|---|---|
| `EMP_AS_OF_DAY` | `2000-01-01` | 스냅샷 날짜. 원천 데이터는 2002-08-01까지 |
| `EMP_MYSQL_PORT` | `3306` | 원천 MySQL 포트(3306이 쓰이고 있을 때 바꾼다) |
| `EMP_MYSQL_HOST`, `EMP_MYSQL_USER` | `127.0.0.1`, `reader` | 00번이 접속하는 곳과 계정 |
| `EMP_MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` | 2장에서 만든다 | 읽기 계정, 컨테이너 root |
| `SOURCE_ROOT`, `DATA_ROOT` | `source`, `s3-local` | 공통(`pipeline/_init/base.sql`) |

## 8. 두 번째 파이프라인이 준 영향

2026-11-17 당시 구조(`pipelines/_shared/`, 파이프라인별 `_catalog/`, `<층>_<표>()` 이름)를 기준으로 쓴 기록이다. 지금 구조는 `lakehouse/AGENTS.md`를 따른다. 그 뒤 `EMP_AS_OF_DAY`는 `pipeline/_init/base.sql`로, 표 이름은 `<tier>.employees.<표>()`로 옮겼다.

| 공통 부분 | 그대로 쓸 수 있었나 | 내용 |
|---|---|---|
| `_shared/_init.sql`의 `root`, `source_root` | 예 | 층 폴더 아래 스키마 폴더(`employees`)만 다르다 |
| `_shared/_init.sql`의 `lake_csv`, `lake_csv_with_file` | 예 | 고치지 않고 모든 층에서 썼다 |
| `_shared/_init.sql`의 기간 값(`origin_root`, `start_day`, `days`, `every_hours`) | 아니오 | jaffle 전용인데 모든 파이프라인이 읽는다. 이 파이프라인은 자기 `_init.sql`에 `EMP_` 접두사로 따로 뒀다 |
| `_shared/_init_s3.sql` | 예(미실행) | 파이프라인과 무관하다 |
| 카탈로그 macro 이름 | 조건부 | 이름에 파이프라인 구분이 없다. 실행마다 한 파이프라인의 카탈로그만 읽어 지금은 겹치지 않는다. 표 이름 `employees`가 스키마 이름과 같아 `bronze_employees_path`가 겹칠 뻔해, 쓰기 경로를 표마다 뒀다 |
| 원천 읽기 | 아니오 | jaffle은 URL이라 `source.sql`에 있었지만, DB는 연결이 필요해 `_catalog/origin.sql`로 나눴다. 90번이 MySQL 없이 돈다 |
| 브론즈 샘플 만들기(폴더 만들기 + COPY 스크립트) | 복사 | 같은 꼴을 복사했다. `build/` 파일 이름이 겹치지 않게 파이프라인 이름을 붙였다 |
| 실버의 실행 고르기(B4) | 복사 | 경로 정규식의 스키마 이름과 표 개수(5 → 6)만 다르다 |
| 데이터 폴더, `.gitignore` | 예 | 스키마 이름이 파이프라인마다 달라야 한다 |
| 원천 기동 | 새로 | 파일을 두지 않고 2장의 `docker` 명령으로만 띄운다 |

후속 제안(아직 하지 않음)은 ADR lakehouse/0004에 있다.

## 출처

- test_db: <https://github.com/datacharmer/test_db> (CC BY-SA 3.0). Git에도 로컬 디스크에도 두지 않고, 실행 때마다 컨테이너 안으로 내려받는다.
- DuckDB MySQL 확장: <https://duckdb.org/docs/stable/core_extensions/mysql>
