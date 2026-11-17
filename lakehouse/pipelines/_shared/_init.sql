-- 모든 파이프라인 SQL이 맨 앞에서 읽는다(작업 폴더 = lakehouse/). 값은 환경 변수로만 바꾼다(README 부록 D).
SET VARIABLE origin_root  = coalesce(nullif(getenv('SOURCE_URL'), ''),
                                     'https://dbt-tutorial-public.s3.us-west-2.amazonaws.com/long_term_dataset');  -- 자르기 전 원본
SET VARIABLE source_root  = coalesce(nullif(getenv('SOURCE_ROOT'), ''), 'source');             -- 시험용 원본
SET VARIABLE root         = coalesce(nullif(getenv('DATA_ROOT'), ''), 's3-local');    -- 로컬: s3-local(버킷 local 의 폴더), 서버: s3://local
SET VARIABLE start_day    = CAST(coalesce(nullif(getenv('START_DAY'), ''), '2019-09-12') AS DATE);
SET VARIABLE days         = CAST(coalesce(nullif(getenv('DAYS'), ''), '3') AS INTEGER);
SET VARIABLE every_hours  = CAST(coalesce(nullif(getenv('BRONZE_EVERY_HOURS'), ''), '3') AS INTEGER);  -- 브론즈 수집 간격
