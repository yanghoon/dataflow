-- 이 파이프라인만 쓰는 값. 모든 본문이 _shared/_init.sql 바로 다음에 읽는다(ADR lakehouse/0004).
-- 환경 변수 이름은 파이프라인 접두사(EMP_)를 붙여 다른 파이프라인 값과 섞이지 않게 한다.
SET VARIABLE emp_as_of_day = CAST(coalesce(nullif(getenv('EMP_AS_OF_DAY'), ''), '2000-01-01') AS DATE);  -- 스냅샷 날짜(하루)
