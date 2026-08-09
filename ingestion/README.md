# Dataflow Ingestion

## db-scheduler 스키마 설정 (v16.12.0)

db-scheduler는 테이블을 자동 생성하지 않으므로 수동 설정이 필요합니다.

### 1. 공식 스키마 다운로드
버전에 맞는 DDL 스크립트를 다운로드하여 `schema.sql`로 저장합니다.
```bash
curl -sL -o src/main/resources/schema.sql https://raw.githubusercontent.com/kagkarlsson/db-scheduler/16.12.0/db-scheduler/src/test/resources/postgresql_tables.sql
```

### 2. 유의사항
- **버전 일치**: 반드시 사용 중인 라이브러리 버전(16.12.0)과 동일한 Git 태그의 DDL을 획득해야 합니다.
- **수동 업그레이드**: 라이브러리 버전 업그레이드 시 `UPGRADING.md`를 확인하고 Flyway 등으로 스키마를 수동 마이그레이션해야 합니다.
- **자동 생성**: 애플리케이션 기동 시 실행되도록 하려면 `spring.sql.init.mode=always`를 설정하세요.
