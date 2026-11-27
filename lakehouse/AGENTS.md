# lakehouse

S3 파일 레이크(bronze → silver → gold)와 그 위의 DuckDB SQL 파이프라인. 새 system type은 `pipeline/jaffle_shop/`과 `pipeline/_catalog/jaffle_shop/`을 본보기로 만든다. DB 원천의 본보기는 `pipeline/employees/`다.

- 실행 명령, 단계 설명: `README.md`
- 환경 변수 목록: `pipeline/.env.example`
- 용어(Tier, System Type, System ID): `GLOSSARY.md`
- 이름(`<tier>.<system_type>.<표>()`), 공통 카탈로그, Airbyte 브론즈 경로: `docs/adr/lakehouse/0005-airbyte-hive-path-and-layer-catalog.md`
- macro 카탈로그를 고른 이유와 기각한 대안: `docs/adr/lakehouse/0002-pipeline-sql-catalog-macros.md`
- DB 원천과 원천 기동: `docs/adr/lakehouse/0004-second-pipeline-mysql-employees.md`
- GitHub Actions 정기 실행(System Type마다 호출 파일 `.github/workflows/lakehouse-<system_type>.yml`): `docs/github-actions.md`, `docs/adr/lakehouse/0006-github-actions-pipeline-per-system-type.md`

ADR 0002·0004·0005의 경로(`pipelines/_shared/…`, `<파이프라인>/_init.sql`)는 결정 당시의 기록이다. 지금 구조는 이 파일을 따른다.

## 구조

```
lakehouse/
  source/  s3-local/  build/          데이터(Git 제외). s3-local/ = 로컬 S3 버킷 local
  pipeline/                           코드는 모두 여기에 둔다
    .env                              Git 제외. run.sh, ui.sh 가 읽는다
    .env.example                      Git 관리. 변수 이름과 기본값만 적는다(비밀 값 없음). cp 로 .env 를 만든다
    run.sh                            INIT_FILES 를 -cmd 로 읽은 뒤, 받은 SQL 파일을 받은 순서대로 실행한다
    ui.sh                             .env → INIT_FILES → _catalog/*/*.sql → DuckDB UI 서버(http://localhost:4213)
    _init/base.sql                    공통 초기화: 환경 변수 → 변수, lake_csv·lake_path·sync_epoch macro, ATTACH bronze/silver/gold
    _init/s3.sql                      S3 인증. S3에서 돌릴 때만 INIT_FILES 에 넣는다
    _init/pg.sql                      gold 를 Postgres 로 붙인다(PG_* 환경 변수). Postgres 에 쓸 때만 INIT_FILES 에 넣는다
    _catalog/<system_type>/<tier>.sql 표 선언. 예: _catalog/jaffle_shop/silver.sql
    <system_type>/                    변환 SQL 파일만 둔다. 하위 폴더는 _sample/ 하나만 둔다
      <번호>_<tier>_<결과>.sql         번호 = 실행 순서. 20번대 silver, 30번대 gold, 90 검증
      _sample/                        로컬 시험용. 정기 실행에 넣지 않는다
        _<정의>.sql                   시험용 원본 정의, 로컬 원천 연결(실행 안 함). 예: _sample.sql, _origin.sql
        <번호>_<결과>.sql              0번대: 시험 데이터 만들기, 9번대: 원본과 비교하는 검사
        README.md                     (있으면) 로컬 시험 방법: 원천 띄우기, 실행 명령
```

- `lakehouse/` 바로 아래에는 데이터 폴더와 문서만 둔다. 코드는 `pipeline/` 아래에 둔다.
- system type 폴더 안의 파일은 파일 이름으로 구분한다. 새 파일은 마지막 번호 다음에 붙인다. 순서를 바꿔야 할 때만 번호를 직접 고친다. 번호는 두 자리(`00`~`99`)로 쓴다. 와일드카드가 이름을 문자 순서로 정렬하기 때문이다.
- system type 전용 초기화 파일은 필요할 때만 만든다.
- 카탈로그 폴더는 system type이 먼저다. 표 이름과 S3 경로는 `<tier>.<system_type>.<표>`, `<root>/<tier>/<system_type>/<표>`다.

## 실행

모든 실행은 `lakehouse/`에서 한다. SQL의 상대 경로(`.read`, `read_csv`, 기본값 `s3-local`, `source`)는 파일 위치가 아니라 현재 폴더 기준이다. `run.sh`와 `ui.sh`는 시작할 때 `lakehouse/`로 이동한다. 그래서 SQL 안의 경로는 `pipeline/_init/base.sql`, `pipeline/_catalog/...`처럼 쓴다.

```bash
pipeline/run.sh pipeline/jaffle_shop/*.sql        # 정기 실행. *.sql 은 하위 폴더로 내려가지 않아 _sample/ 이 골라지지 않는다
pipeline/run.sh pipeline/jaffle_shop/2*.sql       # silver 만
pipeline/run.sh pipeline/jaffle_shop/_sample/0*.sql pipeline/jaffle_shop/*.sql pipeline/jaffle_shop/_sample/9*.sql   # 로컬 시험
pipeline/ui.sh                                    # 조회용 DuckDB UI
```

- `run.sh`는 받은 경로를 `cd`하기 전에 절대 경로로 바꾼다.
- 정기 실행(GHES 등)에는 `_sample/`을 넣지 않는다.

## 초기화와 환경 변수

- 환경 변수는 `pipeline/.env`에 둔다. 목록과 기본값은 `pipeline/.env.example`에만 적는다. 변수를 더하면 이 파일에 함께 적는다.
- 초기화 파일은 `.env`의 `INIT_FILES`로 고른다. 공백으로 나눠 한 줄에 쓰고, 쓴 순서대로 읽는다. 값이 없으면 `pipeline/_init/base.sql` 하나만 읽는다. `run.sh`와 `ui.sh`가 같은 값을 쓴다.
- 변환 SQL도 맨 앞에서 `.read pipeline/_init/base.sql`을 한다. 그래서 `duckdb < 파일`로 단독 실행해도 돈다. 두 번 읽어도 값이 바뀌지 않게 두 규칙을 지킨다.
  - 변수는 `base.sql`에서만 정한다. 환경마다 다른 값은 `.env`로 바꾼다. 다른 초기화 파일(`s3.sql` 등)은 secret과 `ATTACH`만 더한다. secret에 기본값을 넘기는 변수(`s3_region` 등)만 예외다.
  - `base.sql`은 비어 있는 변수만 채운다. 먼저 정한 값이 남는다: `SET VARIABLE root = coalesce(getvariable('root'), nullif(getenv('DATA_ROOT'), ''), 's3-local');`
- `getenv()`는 `_init/`과 `_sample/_origin.sql`에서만 쓴다. 비밀 값은 파일에 두지 않는다. 로컬 원천 DB의 비밀번호는 셸에서 실행마다 만들어 환경 변수로만 넘긴다(`pipeline/employees/_sample/README.md`).
- 로컬 원천(DB 등)은 별도 스크립트나 compose 파일 없이 README의 명령으로 띄운다. 내려받기와 DB 데이터는 컨테이너 안(tmpfs)에 두고, 쓰고 나면 컨테이너를 멈춘다. 로컬에 남는 것은 `source/`, `s3-local/`의 CSV뿐이다.

## 카탈로그: `pipeline/_catalog/<system_type>/<tier>.sql`

이름은 DuckLake와 같은 `<tier>.<system_type>.<표>`다. tier = catalog(`base.sql`의 `ATTACH`), system type = schema, 표 = table macro. 파일 하나 = schema 하나이고, 맨 앞에서 `CREATE SCHEMA IF NOT EXISTS <tier>.<system_type>`을 한다. 표 하나의 정보는 이 파일 하나에만 둔다. 카탈로그 파일끼리는 서로 `.read` 하지 않는다.

표마다 macro 두 개, 경로는 공통 `lake_path` 하나:

| 이름 | 종류 | 담는 것 |
|---|---|---|
| `<tier>.<system_type>.<표>_types()` | scalar | 모든 열의 이름 → 타입(struct) |
| `<tier>.<system_type>.<표>(root := getvariable('root'))` | table | `FROM lake_csv(lake_path('<tier>.<system_type>.<표>', root := root) \|\| '<파일 패턴>', <tier>.<system_type>.<표>_types())`. 읽기 옵션은 `lake_csv`에만 둔다 |
| `lake_path('<tier>.<system_type>.<표>')` | scalar(`base.sql`) | 표 폴더 `<root>/<tier>/<system_type>/<표>` |

- macro는 `CREATE OR REPLACE`로 쓴다. 다시 읽으면 새 정의로 바뀐다. `CREATE OR REPLACE`가 없는 `ATTACH`와 `CREATE SCHEMA`만 `IF NOT EXISTS`로 쓴다. `_sample/`의 정의 파일도 같다.
- 표는 view가 아니라 인자 있는 table macro다. DuckDB 2.0은 view와 인자 없는 macro를 만들 때 파일을 읽어서, 아직 없는 출력을 선언하면 실패한다.
- 스키마는 `types =`로 준다. 이름으로 맞추므로 열 이름이 바뀌면 읽기가 실패한다(`columns =`는 순서로 맞춰서 이름이 바뀌어도 통과한다).
- 여러 본문이 같은 기준을 써야 하는 규칙은 그 카탈로그에 macro로 둔다(예: `silver.jaffle_shop.order_lines_latest()`).
- 수집을 흉내 내는 시험용 원본(origin, source)은 tier가 아니다. `pipeline/<system_type>/_sample/_sample.sql`에 0002 이름(`source_raw_orders()`)으로 둔다.

## 본문: `pipeline/<system_type>/<번호>_<tier>_<결과>.sql`

순서대로 쓴다:

1. 머리 주석: `입력 → 출력` 한 줄과 업무 규칙 몇 줄.
2. `.read pipeline/_init/base.sql`, 그다음 **읽는** tier의 카탈로그만 `.read pipeline/_catalog/<system_type>/<tier>.sql`. 쓰는 tier는 `lake_path` 문자열로 쓰므로 읽지 않는다. `_sample/`의 정의 파일은 `_sample/` 단계만 읽는다. 그래서 정기 실행은 원천 없이 돈다.
3. 마지막 `.read` 다음 줄에 참조 테이블 블록. `.read` 줄 끝에는 주석을 붙일 수 없다(CLI 오류).
   ```sql
   -- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
   --   silver  읽기  silver.jaffle_shop.order_lines_latest()               가장 늦은 스냅샷의 주문 품목
   --   gold    쓰기  lake_path('gold.jaffle_shop.product_daily_sales')     상품 × 주문 날짜(dt)
   ```
4. 로직: 테이블은 카탈로그 이름으로만 읽는다(`FROM silver.jaffle_shop.order_lines_latest()`). `CREATE TEMP TABLE`마다 한 줄 설명을 단다(여러 줄 문장은 윗줄, 한 줄 문장은 줄 끝).
5. 결과는 출력 이름의 임시 테이블로 만들고 `COPY <임시 테이블> TO (lake_path('<tier>.<system_type>.<표>')) (FORMAT csv, HEADER true, PARTITION_BY (…), OVERWRITE_OR_IGNORE true)`로 쓴다.
6. 마지막 줄은 한 줄 통계만: `SELECT '<tier>.<system_type>.<표>' AS written, count(*) AS rows, count(DISTINCT dt) AS partitions FROM <임시 테이블>;`

경로, `read_csv`, `glob`, `getvariable('root')`는 카탈로그(`read_csv`는 `base.sql`의 `lake_csv`)에만 나온다.

검증은 둘로 나눈다. `90_checks.sql`에는 시험용 원본 없이 도는 tier 사이 검사만 둔다(정기 실행에 들어간다). 시험용 원본과 비교하는 검사는 `_sample/90_checks.sql`에 둔다.

## 끝났다고 보는 조건

- 로컬 시험 명령(`pipeline/run.sh pipeline/<system_type>/_sample/0*.sql pipeline/<system_type>/*.sql pipeline/<system_type>/_sample/9*.sql`)이 오류 없이 끝나고, 두 90의 `ok` 열이 모두 `true`다. DB 원천이면 README의 원천 띄우기 명령을 먼저 실행한다.
- `grep -nE "read_csv|glob\(|getvariable\('root'\)" pipeline/<system_type>/*.sql`가 아무것도 찾지 않는다.
- README에 새 system type의 단계와 실행 명령이 있다.
