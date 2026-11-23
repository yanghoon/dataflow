---
status: proposed
date: 2026-11-23
---

# Airbyte 브론즈를 층/종류/stream/인스턴스 경로에 쓰고, `층.종류.stream()` macro로 읽는다

같은 종류의 독립 시스템(인스턴스) 여러 개가 Airbyte S3 destination 하나를 함께 쓴다. DuckDB는 인스턴스별 최신 sync만 읽고, 이전 파일은 이력으로 남긴다. 이름은 DuckLake와 같은 `catalog.schema.table` 모양으로 두어, 나중에 옮길 때 호출 SQL을 거의 바꾸지 않는다.
이 ADR은 ADR airbyte/0005의 B1(폴더 = 예정 시각), lakehouse/0002의 이름 규칙(`{층}_{테이블}()`)과 대치된다.

## 1. 이름

| 이름 | 뜻 | 지금 | DuckLake로 옮긴 뒤 |
|---|---|---|---|
| catalog | 층 | `ATTACH IF NOT EXISTS ':memory:' AS bronze` | `ATTACH 'ducklake:…' AS bronze` |
| schema | 시스템 종류 | `CREATE SCHEMA IF NOT EXISTS bronze.gerrit` | 같음 |
| table | stream | table macro `bronze.gerrit.account()` | table `bronze.gerrit.account` |
| `system_id` | 인스턴스 | hive 열 | `PARTITIONED BY (system_id)` |

## 2. 경로

```
s3://<bucket>/<층>/<종류>/<stream>/system_id=<id>/dt=<YYYY-MM-DD>/hr=<HH>/data_<epoch>_<part>.csv.gz
예) s3://lake/bronze/gerrit/account/system_id=gerrit1/dt=2026-11-08/hr=13/data_1762606802000_0.csv.gz
```

| ID | 규칙 |
|---|---|
| P1 | 모든 층은 `<root>/<층>/<종류>/<table>/system_id=…/` 순서를 따른다 |
| P2 | `dt`, `hr`, `epoch`는 sync 시작 시각(UTC)이다. 한 sync의 모든 part가 같은 `epoch`를 가진다 |
| P3 | 인스턴스마다 `epoch`가 가장 큰 파일들이 최신 sync다. 13자리라 이름순이 시간순이다 |
| P4 | 덮어쓰지 않는다. 이전 sync 파일은 이력으로 남는다 |

> **CAUTION:** 폴더는 "몇 시분 데이터인가"가 아니다. 시간대마다 하나씩 집계하거나, 지난 시간대를 백필할 수 없다.

## 3. Airbyte 설정

### destination (S3, 하나를 함께 씀)

1. destination 하나를 만든다. 모든 종류와 인스턴스가 함께 쓴다.
2. `s3_bucket_path`를 `bronze`로 설정한다.
3. `s3_path_format`을 `${STREAM_NAME}/${NAMESPACE}/dt=${YEAR}-${MONTH}-${DAY}/hr=${HOUR}/data_${EPOCH}_`로 설정한다.
4. `file_name_pattern`은 비워 둔다(기본값 `{part_number}{format_extension}`).
5. 형식을 CSV(gzip)로 설정한다.

### connection (인스턴스마다 하나)

1. Stream Prefix를 `<종류>/`로 설정한다. 예: `gerrit/`
2. Destination Namespace를 Custom `system_id=<id>`로 설정한다. `<id>`는 영문 소문자, 숫자, `_`만 쓴다.
3. 모든 stream의 sync mode를 Append로 설정한다.

> **WARNING:** Overwrite 모드를 쓰지 않는다. 이전 파일이 지워져 이력이 사라진다.

> **CAUTION:** 실패한 sync가 이미 쓴 파일은 남는다. P3은 그 sync를 최신으로 고를 수 있다. 지금은 이 위험을 받아들인다.

> **NOTE:** connection 1은 확인하지 않았다. Stream Prefix에 `/`를 넣을 수 있는지, 그 prefix가 `${STREAM_NAME}`에 포함되는지 확인해야 한다. 실패하면 종류마다 destination을 하나씩 두고 `s3_bucket_path`를 `bronze/<종류>`로 설정한다.

## 4. DuckDB 파일

```
pipelines/_shared/_init_s3.sql              S3 접속 (변경 없음, S3일 때만 -cmd로 먼저 읽음)
pipelines/_shared/_init.sql                 변수, sync_epoch, lake_path, ATTACH bronze/silver/gold
pipelines/_shared/_catalog/<층>/<종류>.sql    schema와 table macro
```

```sql
-- _init.sql (추가분)
CREATE OR REPLACE MACRO sync_epoch(f) AS regexp_extract(f, 'data_(\d+)_', 1);
CREATE OR REPLACE MACRO lake_path(name) AS getvariable('root') || '/' || replace(name, '.', '/');
ATTACH IF NOT EXISTS ':memory:' AS bronze;
ATTACH IF NOT EXISTS ':memory:' AS silver;
ATTACH IF NOT EXISTS ':memory:' AS gold;
```

> **CAUTION:** view를 쓰지 않는다. DuckDB 2.0은 view를 만들 때 파일을 읽어서, 데이터가 없으면 정의 단계에서 실패한다.

## 5. 읽기: 인스턴스별 최신 sync

```sql
-- _catalog/bronze/gerrit.sql
CREATE SCHEMA IF NOT EXISTS bronze.gerrit;
CREATE OR REPLACE MACRO bronze.gerrit.account(root := getvariable('root')) AS TABLE
  FROM read_csv(root || '/bronze/gerrit/account/system_id=*/dt=*/hr=*/*.csv.gz',
                hive_partitioning = true, union_by_name = true, all_varchar = true, filename = true)
  QUALIFY sync_epoch(filename) = max(sync_epoch(filename)) OVER (PARTITION BY system_id);

-- 조회
FROM bronze.gerrit.account() WHERE system_id = 'gerrit1';
```

- `union_by_name`: 인스턴스 버전에 따라 열이 달라도 이름으로 맞추고, 없는 열은 NULL로 채운다.
- `WHERE system_id`: 다른 인스턴스의 파일은 열지 않는다.

## 6. 쓰기: silver 스냅샷

1. 읽는 층의 카탈로그만 `.read`한다. 쓰는 층의 카탈로그는 읽지 않는다.
2. 쓰기 대상은 이름 문자열로 지정한다: `lake_path('silver.gerrit.account')`

```sql
.read pipelines/_shared/_init.sql
.read pipelines/_shared/_catalog/bronze/gerrit.sql

COPY (
  WITH src AS (SELECT *, CAST(sync_epoch(filename) AS BIGINT) AS snapshot_id FROM bronze.gerrit.account())
  SELECT system_id, snapshot_id,
         epoch_ms(snapshot_id) AS snapshot_at,
         CAST(epoch_ms(snapshot_id) AS DATE) AS snapshot_dt,
         CAST(_account_id AS BIGINT) AS account_id, …
  FROM src
) TO (lake_path('silver.gerrit.account'))
  (FORMAT csv, HEADER true, PARTITION_BY (system_id, snapshot_dt, snapshot_id), OVERWRITE_OR_IGNORE true);
```

- 스냅샷마다 폴더가 생겨 silver 이력이 남는다. 같은 스냅샷을 다시 쓰면 덮어써서 중복되지 않는다.

> **CAUTION:** 로컬 실행에서는 `COPY`가 상위 폴더를 만들지 않는다. 쓰기 전에 `<root>/<층>/<종류>`를 만든다.

## 검증 (2026-11-23, DuckDB 2.0.0, 로컬 임시 폴더)

- 통과: 파일 없이 세 단계 macro를 정의함
- 통과: `QUALIFY`로 인스턴스별 최신 sync를 고름
- 통과: `union_by_name`으로 열이 다른 파일을 함께 읽음
- 통과: `WHERE system_id`로 파일을 건너뜀(3개 중 2개만 읽음)
- 통과: `COPY TO (lake_path(…))` partition 쓰기, 재실행해도 중복 없음
- 실패: 파일 없이 view를 만듦
- 실패: `read_csv`에 subquery를 직접 넣음

## Considered Options

- **view(`bronze.gerrit.account`)**: 기각. 호출 SQL은 DuckLake와 같지만, 데이터 없는 stream이 하나만 있어도 그 schema 파일을 읽는 모든 파이프라인이 실패한다.
- **namespace에 종류와 인스턴스를 함께 넣기(`gerrit/system_id=<id>`)**: 기각. `system_id`가 table 앞에 와서 P1이 깨진다.
- **DuckLake 바로 도입**: 보류. Airbyte에 DuckLake destination이 없어 복사 단계가 필요하다. 파일 등록(`ducklake_add_data_files`)은 원본 파일의 소유권을 넘겨 이력 보존과 충돌한다.

## 다시 검토할 조건

- 실패한 sync를 걸러야 할 때: Airbyte job 상태나 성공 표시 파일로 거른다.
- 인스턴스가 늘거나 이력 조회가 잦아질 때: DuckLake(층마다 catalog)로 옮긴다.
