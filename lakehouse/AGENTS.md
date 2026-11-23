# lakehouse

S3 파일 레이크(bronze → silver → gold)와 그 위의 DuckDB SQL 파이프라인. 새 파이프라인은 `pipelines/jaffle_shop_sales/`와 같은 구조로 만든다. 그 폴더가 본보기다.

- 실행 명령, 단계 설명, 환경 변수: `README.md`
- 이름(`<층>.<스키마>.<표>()`), 공통 카탈로그, Airbyte 브론즈 경로: `docs/adr/lakehouse/0005-airbyte-hive-path-and-layer-catalog.md`
- macro 카탈로그를 고른 이유와 기각한 대안: `docs/adr/lakehouse/0002-pipeline-sql-catalog-macros.md`
- DB 원천, 파이프라인 전용 값, 원천 기동 파일: `docs/adr/lakehouse/0004-second-pipeline-mysql-employees.md`(본보기 `pipelines/employees_dept_payroll/`. 이름은 아직 0002 규칙 `<층>_<표>()`)

## 폴더와 역할

```
lakehouse/
  README.md                       실행 방법. 파이프라인을 더하면 단계와 명령을 함께 적는다
  source/  s3-local/  build/      데이터와 생성 파일(Git 제외). s3-local/ = 로컬 S3 버킷 local
  pipelines/
    _shared/_init.sql             공통 환경 변수 → 변수(root, source_root, 기간)
                                  CSV 읽기 macro(lake_csv, lake_csv_with_file), 층 catalog(ATTACH bronze/silver/gold),
                                  경로 macro(lake_path), sync_epoch 도 여기 있다
    _shared/_init_s3.sql          S3 인증. S3에서 돌릴 때만 -cmd 로 붙인다
    _shared/_catalog/<층>/<스키마>.sql   표 선언. 여러 파이프라인이 함께 읽는다
    <파이프라인>/                  파이프라인 1개 = 폴더 1개
      _init.sql                   (있으면) 이 파이프라인만 쓰는 환경 변수 → 변수. 이름에 파이프라인 접두사(EMP_ 등)
      _sample.sql                 (있으면) 수집을 흉내 내는 로컬 시험용 원본(origin, source) macro. 00, 01, 90만 읽는다
      _catalog/origin.sql         (DB 원천일 때) 연결(INSTALL, TEMPORARY SECRET, ATTACH … READ_ONLY)과 원천 표 macro. 00번만 읽는다
      <번호>_<층>_<결과>.sql       본문. 번호 = 실행 순서
```

환경 변수는 `_shared/_init.sql`(공통), `<파이프라인>/_init.sql`(파이프라인 전용), `_catalog/origin.sql`(원천 접속)에서만 읽는다. 로컬 원천 DB의 비밀번호는 파일에 두지 않는다(S3 인증은 Git 제외 `.env`, README 9장). 셸에서 실행마다 만들어 환경 변수로만 넘긴다.

로컬 원천(DB 등)은 별도 스크립트나 compose 파일 없이 파이프라인 README의 명령으로 띄운다. 내려받은 파일이나 볼륨을 남기지 않는다. 내려받기와 DB 데이터는 컨테이너 안(tmpfs)에 두고, 쓰고 나면 컨테이너를 멈춘다. 로컬에 남는 것은 `source/`, `s3-local/`의 CSV뿐이다.

본문 번호: 00번대 로컬 샘플(`<번호>_sample_<층>.sql`), 10번대 실제 수집 자리, 20번대 실버, 30번대 골드, 90 검증.

## 카탈로그: `_shared/_catalog/<층>/<스키마>.sql`

이름은 DuckLake와 같은 `<층>.<스키마>.<표>`다. 층 = catalog(`_init.sql`의 `ATTACH`), 스키마 = 원천 종류(`jaffle_shop`, `gerrit`), 표 = table macro. 파일 하나 = 스키마 하나이고, 맨 앞에서 `CREATE SCHEMA IF NOT EXISTS <층>.<스키마>`를 한다. 표 하나의 정보는 이 파일 하나에만 둔다. 카탈로그 파일끼리는 서로 `.read` 하지 않는다.

표마다 macro 두 개, 경로는 공통 `lake_path` 하나:

| 이름 | 종류 | 담는 것 |
|---|---|---|
| `<층>.<스키마>.<표>_types()` | scalar | 모든 열의 이름 → 타입(struct) |
| `<층>.<스키마>.<표>(root := getvariable('root'))` | table | `FROM lake_csv(lake_path('<층>.<스키마>.<표>', root := root) \|\| '<파일 패턴>', <층>.<스키마>.<표>_types())`. 읽기 옵션은 `lake_csv`에만 둔다 |
| `lake_path('<층>.<스키마>.<표>')` | scalar(`_init.sql`) | 표 폴더 `<root>/<층>/<스키마>/<표>` |

- 모든 정의는 `CREATE OR REPLACE`로 쓴다. 같은 파일을 두 번 읽어도 된다.
- 표는 view가 아니라 인자 있는 table macro다. DuckDB 2.0은 view와 인자 없는 macro를 만들 때 파일을 읽어서, 아직 없는 출력을 선언하면 실패한다.
- 스키마는 `types =`로 준다. 이름으로 맞추므로 열 이름이 바뀌면 읽기가 실패한다(`columns =`는 순서로 맞춰서 이름이 바뀌어도 통과한다).
- 여러 본문이 같은 기준을 써야 하는 규칙은 그 카탈로그에 macro로 둔다(예: `silver.jaffle_shop.order_lines_latest()`).
- 수집을 흉내 내는 시험용 원본(origin, source)은 층이 아니다. 파이프라인의 `_sample.sql`에 0002 이름(`source_raw_orders()`)으로 둔다.

## 본문: `<번호>_<층>_<결과>.sql`

순서대로 쓴다:

1. 머리 주석: `입력 → 출력` 한 줄과 업무 규칙 몇 줄.
2. `.read pipelines/_shared/_init.sql`, (있으면) `.read pipelines/<파이프라인>/_init.sql`, 그다음 **읽는** 층의 카탈로그만 `.read pipelines/_shared/_catalog/<층>/<스키마>.sql`. 쓰는 층은 `lake_path` 문자열로 쓰므로 읽지 않는다. `_sample.sql`과 `origin.sql`은 정해진 단계만 읽어 나머지가 원천 없이 돈다.
3. 마지막 `.read` 다음 줄에 참조 테이블 블록. `.read` 줄 끝에는 주석을 붙일 수 없다(CLI 오류).
   ```sql
   -- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
   --   silver  읽기  silver.jaffle_shop.order_lines_latest()               가장 늦은 스냅샷의 주문 품목
   --   gold    쓰기  lake_path('gold.jaffle_shop.product_daily_sales')     상품 × 주문 날짜(dt)
   ```
4. 로직: 테이블은 카탈로그 이름으로만 읽는다(`FROM silver.jaffle_shop.order_lines_latest()`). `CREATE TEMP TABLE`마다 한 줄 설명을 단다(여러 줄 문장은 윗줄, 한 줄 문장은 줄 끝).
5. 결과는 출력 이름의 임시 테이블로 만들고 `COPY <임시 테이블> TO (lake_path('<층>.<스키마>.<표>')) (FORMAT csv, HEADER true, PARTITION_BY (…), OVERWRITE_OR_IGNORE true)`로 쓴다.
6. 마지막 줄은 한 줄 통계만: `SELECT '<층>.<스키마>.<표>' AS written, count(*) AS rows, count(DISTINCT dt) AS partitions FROM <임시 테이블>;`

경로, `read_csv`, `glob`, `getvariable('root')`는 카탈로그(`read_csv`는 `_shared/_init.sql`의 `lake_csv`)에만 나온다. 결과 검증은 90번 파일이 한다.

## 끝났다고 보는 조건

- 로컬에서 00(또는 첫 단계, DB 원천이면 README의 원천 띄우기 명령)부터 90까지 `duckdb -bail < <파일>`이 모두 오류 없이 끝나고, 90의 `ok` 열이 모두 `true`다.
- 본문에서 `grep -nE "read_csv|glob\(|getvariable\('root'\)" <파이프라인>/[0-9]*.sql`가 아무것도 찾지 않는다.
- README에 새 파이프라인의 단계와 실행 명령이 있다.
