# Batch SQL 로더 및 파라미터 바인딩 설계 스펙

## 목표
- Spring Batch 개발 시 파편화된 SQL 관리를 개선하기 위한 공통 SQL 로더(`SqlResources`) 도입
- `JdbcCursorItemReader` 등에서 Named Parameter(`:name`)와 Record 객체를 네이티브처럼 바인딩하는 표준 방식 확립

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: Java 코드 내부의 인라인(String) SQL 작성 및 수동 `PreparedStatementSetter` 파라미터 매핑
- 신규로 가는 이유 (기존 걸로 안 되는 이유): 
  - 긴 SQL을 자바 코드 내에 문자열로 작성하면 가독성이 떨어지고 DB 툴에서 쿼리를 바로 테스트하기 어려움.
  - Reader(`JdbcCursorItemReader`)는 기본적으로 `?` 위치 기반 파라미터만 지원하므로, 파라미터가 많은 경우 순서 매핑 오류가 발생하기 쉬움.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | N/A (배치 프레임워크 위임) | 해당 설계는 인프라스트럭처/유틸리티 성격이므로 Spring Batch의 기본 Job/Step 설정에 의존 |
| 동시성 제어 | `ConcurrentHashMap` 기반 캐싱 | `SqlResources`가 싱글톤 빈으로 동작하며 여러 스레드(멀티스레드 스텝 등)에서 동시 접근 가능하므로 스레드 안전성 확보 |
| 실패/재시도 | N/A (배치 프레임워크 위임) | - |
| 데이터 모델 | `Record` 기반 파라미터 객체 | 불변성 보장 및 `BeanPropertySqlParameterSource`를 통한 자동 바인딩 지원으로 보일러플레이트 제거 |
| 파라미터 시간 결합 (절대/상대, 계산 위치) | `targetDate` Job Parameter를 사용한 절대값 주입 | 쿼리 내 `now()` 사용 시 재실행 멱등성이 깨짐. 실행 시점에 `targetDate`를 주입받아 애플리케이션 외부(파라미터)에서 시간을 제어하여 멱등성 보장 |
| SQL 파일 배포 경로 | `classpath:sql/**/*.sql` | SQL 파일은 비즈니스 로직(도메인 상태 전이 등)과 강하게 결합되어 함께 버저닝되므로 JAR 내부에 포함시켜 배포. (환경별 분리가 필요한 값은 Job Parameter로 처리) |
| Reader Named Parameter 바인딩 | `NamedParameterUtils` 활용 | 외부 사례 조사 결과, 커스텀 Reader를 만들지 않고도 Spring JDBC 내장 유틸(`parseSqlStatement`, `substituteNamedParameters`, `buildValueArray`)을 사용해 완벽한 Named Parameter 지원 구현 가능 |

## 외부 사례 조사: `JdbcCursorItemReader`의 Named Parameter 바인딩
Reader 쪽에서 `:targetDate` 등의 Named Parameter를 네이티브처럼 쓰기 위해 다음과 같이 Spring 내장 유틸리티를 활용합니다.
```java
SqlParameterSource paramSource = new BeanPropertySqlParameterSource(condition);
ParsedSql parsedSql = NamedParameterUtils.parseSqlStatement(sql);

// 1. :name을 ?로 치환한 SQL
String preparedSql = NamedParameterUtils.substituteNamedParameters(parsedSql, paramSource);
// 2. ? 순서에 맞게 추출된 파라미터 배열
Object[] values = NamedParameterUtils.buildValueArray(parsedSql, paramSource, null);

return new JdbcCursorItemReaderBuilder<Long>()
    .sql(preparedSql)
    .preparedStatementSetter(new ArgumentPreparedStatementSetter(values))
    // ...
```

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과
- [ ] 유닛테스트: `SqlResources`가 클래스패스의 SQL을 정확히 로드하고 키를 추출해 캐싱하는지 검증
- [ ] 유닛테스트: `NamedParameterUtils`를 활용한 Reader 설정이 레코드 필드를 올바르게 바인딩하는지 검증
- [ ] 커버리지 기준: 85%

## 미결 사항
- 없음
