# lakehouse

S3 파일 레이크(source → bronze → silver → gold)와 그 위의 DuckDB SQL 파이프라인. 새 파이프라인은 `pipelines/jaffle_shop_sales/`와 같은 구조로 만든다. 그 폴더가 본보기다.

- 실행 명령, 단계 설명, 환경 변수: `README.md`
- 이 구조를 고른 이유와 기각한 대안: `docs/adr/lakehouse/0002-pipeline-sql-catalog-macros.md`

## 폴더와 역할

```
lakehouse/
  README.md                       실행 방법. 파이프라인을 더하면 단계와 명령을 함께 적는다
  source/  s3-local/  build/      데이터와 생성 파일(Git 제외). s3-local/ = 로컬 S3 버킷 local
  pipelines/
    _shared/_init.sql             환경 변수 → 변수(root, source_root, 기간). 환경 변수를 읽는 유일한 곳
    _shared/_init_s3.sql          S3 인증. S3에서 돌릴 때만 -cmd 로 붙인다
    <파이프라인>/                  파이프라인 1개 = 폴더 1개
      _catalog/<층>.sql           그 층 테이블의 스키마, 위치, 읽기. 선언만 둔다
      <번호>_<층>_<결과>.sql       본문. 번호 = 실행 순서
```

본문 번호: 00번대 로컬 샘플(`<번호>_sample_<층>.sql`), 10번대 실제 수집 자리, 20번대 실버, 30번대 골드, 90 검증.

## 카탈로그: `_catalog/<층>.sql`

층(source, bronze, silver, gold)마다 파일 하나. 테이블 하나의 정보는 이 파일 하나에만 둔다. 층 파일끼리는 서로 `.read` 하지 않는다.

테이블마다 macro 세 개:

| macro | 종류 | 담는 것 |
|---|---|---|
| `<층>_<표>_types()` | scalar | 모든 열의 이름 → 타입(struct) |
| `<층>_<표>(root := getvariable('root'))` | table | `read_csv(<층>_<표>_path(root := root) …, all_varchar = true, types = <층>_<표>_types())` |
| `<층>_<표>_path(root := getvariable('root'))` | scalar | 테이블 폴더나 파일 경로 |

- 읽기 macro는 위치 인자를 기본값과 함께 받는다. DuckDB 2.0은 인자 없는 macro를 만들 때 파일을 읽어서, 아직 없는 출력을 선언하면 실패한다.
- 스키마는 `types =`로 준다. 이름으로 맞추므로 열 이름이 바뀌면 읽기가 실패한다(`columns =`는 순서로 맞춰서 이름이 바뀌어도 통과한다).
- 여러 본문이 같은 기준을 써야 하는 규칙은 그 층 카탈로그에 macro로 둔다(예: `silver_order_lines_latest()`).

## 본문: `<번호>_<층>_<결과>.sql`

순서대로 쓴다:

1. 머리 주석: `입력 → 출력` 한 줄과 업무 규칙 몇 줄.
2. `.read pipelines/_shared/_init.sql`, 그다음 필요한 층의 `.read pipelines/<파이프라인>/_catalog/<층>.sql`만.
3. 마지막 `.read` 다음 줄에 참조 테이블 블록. `.read` 줄 끝에는 주석을 붙일 수 없다(CLI 오류).
   ```sql
   -- 참조 테이블(층 · 읽기/쓰기 · 이름 · 쓰임)
   --   silver  읽기  silver_order_lines_latest()      가장 늦은 스냅샷의 주문 품목
   --   gold    쓰기  gold_product_daily_sales_path()  상품 × 주문 날짜(dt)
   ```
4. 로직: 테이블은 카탈로그 이름으로만 읽는다(`FROM silver_order_lines_latest()`). `CREATE TEMP TABLE`마다 한 줄 설명을 단다(여러 줄 문장은 윗줄, 한 줄 문장은 줄 끝).
5. 결과는 출력 이름의 임시 테이블로 만들고 `COPY <임시 테이블> TO (<층>_<표>_path()) (FORMAT csv, HEADER true, PARTITION_BY (…), OVERWRITE_OR_IGNORE true)`로 쓴다.
6. 마지막 줄은 한 줄 통계만: `SELECT '<층>.<표>' AS written, count(*) AS rows, count(DISTINCT dt) AS partitions FROM <임시 테이블>;`

경로, `read_csv`, `glob`, `getvariable('root')`는 카탈로그에만 나온다. 결과 검증은 90번 파일이 한다.

## 끝났다고 보는 조건

- 로컬에서 00(또는 첫 단계)부터 90까지 `duckdb -bail < <파일>`이 모두 오류 없이 끝나고, 90의 `ok` 열이 모두 `true`다.
- 본문에서 `grep -nE "read_csv|glob\(|getvariable\('root'\)" <파이프라인>/[0-9]*.sql`가 아무것도 찾지 않는다.
- README에 새 파이프라인의 단계와 실행 명령이 있다.
