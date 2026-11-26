# Lakehouse

S3 파일 레이크(bronze → silver → gold)와 그 위에서 도는 DuckDB SQL 파이프라인의 컨텍스트. 용어는 영문 이름을 정본으로 쓰고, 한글 문장에서는 `_한글_` 표현을 쓴다.

## Language

**Tier**:
데이터가 가공된 정도에 따른 단계. bronze(수집 원본), silver(정제한 스냅샷), gold(집계 결과) 세 가지다. DuckDB에서는 catalog 이름이 된다.
_한글_: 층
_Avoid_: layer, 레이어, catalog(기술 이름으로만 씀)

**System Type**:
데이터를 주는 원천 시스템의 종류. 예: `gerrit`, `jaffle_shop`, `employees`. DuckDB에서는 schema 이름이 되고, 카탈로그와 파이프라인 폴더 이름이 된다.
_한글_: 시스템 종류
_Avoid_: system_type(경로 표기로만 씀), 원천 종류, 종류(단독 사용), 스키마(기술 이름으로만 씀)

**System ID**:
같은 System Type의 독립된 설치본 하나와 그 식별 값. 설치본마다 버전과 데이터가 다를 수 있다. 열과 경로에서는 `system_id`로 쓴다.
_한글_: 인스턴스
_Avoid_: instance, 시스템(단독 사용), 서버
