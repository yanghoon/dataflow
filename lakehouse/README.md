# Lakehouse: source → bronze → silver → gold

## 0. 무엇을 만드나

S3 파일 저장소와 그 위에서 도는 SQL 변환을 함께 둔다. `source/`의 시험용 원본을 기준으로 브론즈, 실버, 골드를 차례로 만들고, 여러 수집 경로(Kestra, Airbyte 등)를 시험할 때도 같은 원본을 쓴다.
로컬 디스크에서 DuckDB CLI로 SQL을 검증하고, 서버에서는 같은 SQL로 S3의 파일을 읽는다. Kestra는 이 SQL을 DuckDB로 호출한다.
**상태: 로컬 디스크에서 2~6을 실행해 검증 10개가 모두 통과했다(2026-11-17, DuckDB 2.0.0, 2는 원본 주소에서 직접 읽어 약 30초).** S3는 임시 versitygw(`s3://local`)에서 4~6을 두 번 연속 실행해 통과했고, 결과가 로컬과 같았다. Kestra 호출은 아직 실행하지 않았다.

Hive에서 비롯된, S3 파일 기반 데이터 레이크의 기본 폴더 구조를 따른다. `키=값` 폴더는 DuckDB, Spark, Trino가 파티션 열로 읽고, 조건이 있으면 그 폴더만 읽는다.

```
lakehouse/
  source/jaffle_shop/raw_<표>.csv            시험용 원본(기준). 수집 경로가 읽는 곳. CSV
  s3-local/                                 로컬 S3 버킷 s3://local 의 내용 = 이 폴더
    bronze/jaffle_shop/<표>/dt=YYYY-MM-DD/hr=HH/<실행 시각>_<실행 ID>.csv
    silver/jaffle_shop/order_lines/dt=YYYY-MM-DD/hr=HH/data_0.csv
    gold/jaffle_shop/<집계>/dt=YYYY-MM-DD/data_0.csv
  pipelines/
    _shared/_init.sql                        모든 파이프라인 공통: 환경 변수 → 위치·기간 변수, 층 catalog(bronze/silver/gold), lake_path
    _shared/_init_s3.sql                     S3 인증. S3에서 돌릴 때만 -cmd 로 붙인다
    _shared/_catalog/<층>/<스키마>.sql        표 위치·스키마를 <층>.<스키마>.<표>() macro로 선언(ADR lakehouse/0002, 0005)
    jaffle_shop_sales/                       파이프라인 1개 = 폴더 1개. 번호 = 실행 순서
      _sample.sql                            수집을 흉내 내는 시험용 원본(origin, source). 00, 01, 90만 읽는다
```

SQL 본문은 `_init.sql`과 읽는 층의 `_shared/_catalog/<층>/<스키마>.sql`을 읽은 뒤 표를 이름으로만 읽고 쓴다(`FROM silver.jaffle_shop.order_lines_latest()`, `COPY … TO (lake_path('gold.jaffle_shop.product_daily_sales'))`). 각 단계는 끝에 쓴 표 이름과 건수만 출력하고, 결과 검증은 `90_checks.sql`이 한다.

한 번에 모두 실행(각 단계 설명은 2~6):

```bash
cd lakehouse
P=pipelines/jaffle_shop_sales
mkdir -p source/jaffle_shop
duckdb -bail < $P/00_sample_source.sql
duckdb -bail < $P/01_sample_bronze.sql
mkdir -p s3-local/silver/jaffle_shop s3-local/gold/jaffle_shop
duckdb -bail < $P/20_silver_order_lines.sql
duckdb -bail < $P/30_gold_store_daily_sales.sql
duckdb -bail < $P/31_gold_product_daily_sales.sql
duckdb -bail < $P/90_checks.sql
```

## 1. 준비

준비: DuckDB CLI 하나. 설치는 `brew install duckdb`(macOS) 또는 `curl https://install.duckdb.org | sh`(macOS·Linux). 설치 없이 쓰려면 `alias duckdb='uvx --from duckdb-cli duckdb'`. 모든 명령은 `lakehouse/`에서 실행한다. 모든 층의 파일은 CSV다.

```bash
cd lakehouse
P=pipelines/jaffle_shop_sales
```

## 2. 소스 만들기 (`00_sample_source.sql`)

2~3은 샘플 만들기(00번대)다. 로컬 전용이고, 한 번 만들면 계속 쓴다.

```bash
# source: 원본 주소에서 DuckDB가 바로 읽어 3일치만 자르기(기본 2019-09-12 ~ 2019-09-14) → source/jaffle_shop/*.csv
# 원본 전체(약 550MB)를 흘려 받고, 디스크에는 잘린 결과(약 1MB)만 남는다
mkdir -p source/jaffle_shop
duckdb -bail < $P/00_sample_source.sql
```

만들어지는 파일:

- `source/jaffle_shop/raw_stores.csv`: 매장. 기간 끝 전에 연 매장(LA 포함)
- `source/jaffle_shop/raw_orders.csv`: 3일치 주문. 수집 경로 시험의 기준 표
- `source/jaffle_shop/raw_order_items.csv`: 위 주문의 품목
- `source/jaffle_shop/raw_customers.csv`, `raw_products.csv`: 전체 고객, 전체 상품

출처와 데이터 기준:

| 항목 | 내용 |
|---|---|
| 출처 | dbt Labs **Jaffle Shop** 장기 데이터셋(`jafgen`으로 만든 합성 데이터). 공개 S3 `s3://dbt-tutorial-public/long_term_dataset/` |
| 내려받는 곳 | `https://dbt-tutorial-public.s3.us-west-2.amazonaws.com/long_term_dataset/<표>.csv` |
| 표 | `raw_stores`(매장), `raw_orders`(주문), `raw_order_items`(주문 품목), `raw_customers`(고객), `raw_products`(상품) |
| 관계 | 매장(상위) ← 주문(실제 데이터, `store_id`) ← 품목(연결 데이터, `order_id`). 주문 → 고객(`customer`), 품목 → 상품(`sku`) |
| 기간 | 기본 2019-09-12 00:00 ~ 2019-09-15 00:00(3일, UTC로 본다). 원본 전체는 약 6년치 |
| 고른 이유 | 2019-09-13에 Los Angeles 매장이 문을 열어, 주문 없는 매장(full join)과 새 매장이 생기는 날을 함께 볼 수 있다 |
| 자르는 규칙 | 주문은 기간 안의 것, 품목은 그 주문의 것, 매장은 기간이 끝나기 전에 연 것, 고객·상품은 전체 |
| 원본 형식 | 바꾸지 않는다. 열 이름, 값 표기(시각 `YYYY-MM-DD HH:MM:SS`, 금액은 센트 정수)를 그대로 둔다 |
| 라이선스 | 저장소에 명시되어 있지 않다. 그래서 데이터 파일은 Git에 올리지 않고(`.gitignore`) 위 명령으로 다시 만든다. 같은지는 6의 건수와 `90_checks.sql`로 확인한다 |

처리:

- source는 원본 그대로다. 층이 아니라 시험용 원천 시스템 역할이다.
- DuckDB(httpfs)가 원본 주소의 CSV를 흘려 읽으며 위 규칙대로 자른다. 원본은 날짜순이 아니라(주문은 고객 순, 품목은 날짜 열이 없음) 일부만 받을 수 없다.
- `SOURCE_URL`로 원본 위치를 바꿀 수 있다. 미리 받아 둔 폴더를 주면 그 파일을 읽는다.

## 3. 브론즈 만들기 (`01_sample_bronze.sql`)

```bash
# bronze: 3시간마다 전체 수집한 것처럼 만든다(24개 스냅샷 × 표 5개 = 120개 CSV)
# 나중에는 이 단계 대신 Airbyte 등 실제 수집이 같은 규칙으로 bronze 를 쓴다
duckdb -bail < $P/01_sample_bronze.sql
```

만들어지는 파일:

- `s3-local/bronze/jaffle_shop/<표>/dt=*/hr=*/*.csv`: 로컬 샘플. 스냅샷 24개(00, 03, …, 21시) × 표 5개. 첫날 이른 스냅샷의 주문·품목 파일은 헤더만 있다(아직 주문이 없음)

규칙: 지금은 로컬 전용 샘플(`01_sample_bronze.sql`), 나중에는 실제 수집(Airbyte 등)이 쓴다. `dt`/`hr` = 수집 예정 시각(UTC). 파일 이름 = `<실행 시각>_<실행 ID>`라 다시 돌려도 덮어쓰지 않는다. 원본 형식 그대로(ADR-0005 B1~B7).

처리:

- 실제 수집이 붙기 전까지 그 결과를 대신하는 샘플이다. 서버나 S3에서는 돌리지 않는다. 나중에 Airbyte 등이 `s3://local/bronze/...`에 같은 규칙으로 쓰면 이 단계는 빼고, 실버부터 그대로 돈다.
- 스냅샷 시각 T = 시작일 00:00부터 3시간 간격. T 시점의 원본: 매장 `opened_at <= T`, 주문 `ordered_at < T`, 품목은 그 주문의 것, 고객·상품 전체.
- 실행 시각 = T + 5분, 실행 ID = `sim<YYYYMMDDHH>`(Kestra 실행 ID 대신 쓰는 흉내 값).
- DuckDB `COPY`는 없는 폴더를 만들지 않는다. 그래서 SQL이 폴더 만들기(`.shell mkdir -p`)와 COPY 문을 `build/bronze_local_sample.sql`에 쓰고 `.read`로 바로 실행한다. DuckDB CLI 하나로 끝난다.

## 4. 실버 만들기 (`20_silver_order_lines.sql`)

```bash
# silver: 스냅샷마다 full join → CSV
# 로컬 디스크에서는 DuckDB가 상위 폴더를 만들지 않으므로 먼저 만든다(S3에서는 필요 없음)
mkdir -p s3-local/silver/jaffle_shop s3-local/gold/jaffle_shop
duckdb -bail < $P/20_silver_order_lines.sql
```

만들어지는 파일:

- `s3-local/silver/jaffle_shop/order_lines/dt=*/hr=*/data_0.csv`: 한 행 = 주문 품목 하나. 주문 없는 매장은 주문 열이 NULL인 한 행

규칙: 폴더마다 표 5개가 모두 있는 실행 중 파일 이름이 가장 늦은 것 하나만 쓴다(B4). 다시 만들면 같은 이름으로 덮어쓴다.

처리:

- 조인: 매장 ⟗ 주문(`store_id`) ⟗ 품목(`order_id`)은 full join, 고객·상품은 left join. 모두 같은 실행(`run`) 안에서만 잇는다.
- 추가 열: `snapshot_at`(스냅샷 예정 시각), `bronze_run`(어느 브론즈 실행에서 왔는지). `dt`, `hr`는 파일 안에 없고 폴더 이름이 된다.
- CSV는 타입이 없다. 읽을 때는 `all_varchar = true, allow_quoted_nulls = false`로 읽고 타입을 바꾼다. 표마다 열과 타입은 `_shared/_catalog/<층>/<스키마>.sql`의 `<층>.<스키마>.<표>_types()` 한 곳에서 정하고, 읽기 macro가 `types=`로 쓴다. 열 이름이 바뀌거나 빠지면 읽기가 실패한다. NULL은 따옴표 없는 빈 값으로 쓴다.

## 5. 골드 만들기 (`30_gold_store_daily_sales.sql`, `31_gold_product_daily_sales.sql`)

```bash
# gold: 매장별, 상품별 일 집계 → CSV
duckdb -bail < $P/30_gold_store_daily_sales.sql
duckdb -bail < $P/31_gold_product_daily_sales.sql
```

만들어지는 파일:

- `s3-local/gold/jaffle_shop/store_daily_sales/dt=*/data_0.csv`: 매장 × 날짜. 주문 수, 매출, 세금, 평균 주문 금액. 열려 있던 매장은 주문이 없어도 0
- `s3-local/gold/jaffle_shop/product_daily_sales/dt=*/data_0.csv`: 상품 × 날짜. 판매 수, 매출

규칙: `dt` = 주문 날짜. 가장 늦은 실버 스냅샷 하나로 만든다. 다시 만들면 덮어쓴다.

처리:

- 실버는 품목 단위라 주문 금액이 반복된다. 매출은 주문을 한 번씩만 세서 더한다. 합계는 BIGINT로 쓴다.
- `store_daily_sales`: 매장 × 날짜 뼈대(그날 열려 있던 매장)에 주문을 붙인다.
- `product_daily_sales`: 품목 행을 상품 × 날짜로 센다.

## 6. 검증하기 (`90_checks.sql`)

```bash
# 검증: ok 열이 모두 true
duckdb -bail < $P/90_checks.sql
```

기간, 파일 수, 스냅샷 수, 실버와 원본의 건수, full join 행, 골드 합계와 원본 합계를 비교한다.

기본값(2019-09-12부터 3일, 3시간 간격)으로 만든 실측(2026-11-16):

| 층 | 크기 | 건수 |
|---|---|---|
| 원본(받는 양) | 약 546MB | 전체 6년치. 디스크에 남지 않는다 |
| source | 약 900KB | 주문 2,742, 품목 4,077, 매장 6, 고객 3,102, 상품 10 |
| bronze | 13MB | CSV 120개(스냅샷 24 × 표 5) |
| silver | 16MB | 24개 스냅샷 합계 52,406행. 그중 주문 없는 매장 행 18 |
| gold | 24KB | 매장 × 날짜 17행(LA는 09-13부터), 상품 × 날짜 |

9월 14일(토)은 주문이 13:57에서 끝나 다른 날보다 적다. 원본이 그렇다.

## 7. 결과 열어 보기

```bash
duckdb -c "SELECT * FROM read_csv('s3-local/silver/jaffle_shop/order_lines/dt=*/hr=*/*.csv', hive_partitioning = true) WHERE dt = '2019-09-13' AND hr = 12 LIMIT 10"
duckdb -c "SELECT * FROM read_csv('s3-local/gold/jaffle_shop/store_daily_sales/dt=*/*.csv') ORDER BY order_date, store_name"
```

## 8. 다시 만들기, 값 바꾸기

다른 기간이나 간격으로 만들려면 2부터 `START_DAY=2020-06-01 DAYS=2 BRONZE_EVERY_HOURS=6`처럼 같은 값을 모든 단계에 준다. 다시 만들 때는 `rm -rf source/jaffle_shop/* s3-local build` 뒤 2부터 실행한다. 같은 기간이면 원본을 다시 받을 필요 없이 3부터 실행한다.

| 환경 변수 | 기본값 | 뜻 |
|---|---|---|
| `SOURCE_URL` | `https://dbt-tutorial-public.s3.us-west-2.amazonaws.com/long_term_dataset` | 자르기 전 원본 위치(`00_sample_source.sql`만 씀). 로컬 폴더도 된다 |
| `SOURCE_ROOT` | `source` | 시험용 원본 폴더 |
| `DATA_ROOT` | `s3-local` | 브론즈·실버·골드의 최상위. 서버는 `s3://...` |
| `START_DAY` | `2019-09-12` | 자를 기간의 첫날 |
| `DAYS` | `3` | 기간 일수 |
| `BRONZE_EVERY_HOURS` | `3` | 브론즈 수집 간격(24의 약수). 스냅샷 수 = 24 / 간격 × DAYS |

## 9. 서버(S3)에서 돌리기

- 서버에서는 `DATA_ROOT=s3://local`(또는 `s3://<버킷>/<접두사>`)로 같은 SQL을 실행하고, S3 인증을 먼저 읽힌다.

```bash
set -a; . ./.env; set +a     # .env 는 Git 제외. 값을 명령줄이나 SQL에 적지 않는다
DATA_ROOT=s3://local duckdb -bail -cmd ".read pipelines/_shared/_init_s3.sql" < pipelines/jaffle_shop_sales/20_silver_order_lines.sql
```

- `.env`에 넣는 값: `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_KEY_ID`, (선택) `S3_REGION`, `S3_URL_STYLE`, `S3_USE_SSL`. 인증은 `TEMPORARY SECRET`이라 프로세스가 끝나면 사라진다. 에어갭에서는 httpfs 확장을 미리 넣어 둔다.
- 로컬 S3 서버에서 버킷 `local`이 `s3-local/` 폴더를 가리키게 하면(예: versitygw posix의 루트 아래 `local`로 `s3-local/`을 마운트), Kestra와 Airbyte(S3 목적지)가 `s3://local`에 쓴 파일이 이 폴더에 그대로 보이고 로컬 SQL도 그대로 읽는다. 아직 연결하지 않았다.

## 부록 A. 원본 열

| 표 | 열 |
|---|---|
| `raw_stores` | `id`, `name`, `opened_at`, `tax_rate` |
| `raw_orders` | `id`, `customer`, `ordered_at`, `store_id`, `subtotal`, `tax_paid`, `order_total` |
| `raw_order_items` | `id`, `order_id`, `sku` |
| `raw_customers` | `id`, `name` |
| `raw_products` | `sku`, `name`, `type`, `price`, `description` |

ID는 모두 UUID 문자열, 상품은 `JAF-001` 같은 SKU다. 금액(`subtotal`, `tax_paid`, `order_total`, `price`)은 센트 정수다.

## 부록 B. 이름 규칙

파이프라인 폴더 안 파일 이름: `<번호>_<층>_<결과 이름>.sql`. 번호 00번대 로컬 샘플(00 소스, 01 브론즈), 10번대 실제 수집 자리(비워 둠), 20 실버, 30번대 골드, 90 검증. 샘플 파일은 `<번호>_sample_<층>.sql`.

## 부록 C. 출처

- Jaffle Shop: <https://github.com/dbt-labs/jaffle-shop>
- 생성기 jafgen: <https://github.com/dbt-labs/jaffle-shop-generator>
- 브론즈 파일 규칙: [ADR-0005](../docs/adr/airbyte/0005-kestra-pull-ingestion-instead-of-airbyte.md) B1~B7
