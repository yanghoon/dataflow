# Spring Batch Upstream 연동 설계 문서

## 1. 요구사항 및 의사결정
* **다중 환경 지원:** 여러 Spring Batch 대상(Upstream) 서버를 환경(dev, prod 등)별로 동적 관리.
* **API 커스텀 중계:** 브라우저 CORS 이슈를 방지하고 환경을 동적으로 선택하기 위해, 단순 Proxy 플러그인이 아닌 Backstage 백엔드에 커스텀 API 라우터를 구현하기로 결정.
* **장애 격리 (Fallback):** Upstream 서버와의 통신에 장애가 발생하더라도 프론트엔드 UI 렌더링이 멈추지 않도록, `job-names` 조회 실패 시 기본 데이터(`httpJob`)를 반환하도록 설계.

## 2. 호출 구조 (Call Structure)
* **목록 조회:** `GET /api/spring-batch-dashboard/job-names`
  * ↳ Backend Fetch ↳ `GET {UPSTREAM_URL}/job-names`
* **작업 실행:** `POST /api/spring-batch-dashboard/executions`
  * ↳ Backend Fetch ↳ `POST {UPSTREAM_URL}/executions`

## 3. 논리적 흐름 (Logical Flow)
1. **설정 참조:** `app-config.yaml`에 정의된 `springBatch.databases.{env}.http.url`에서 타겟 URL 로드.
2. **UI 진입:** 사용자가 `ExecuteJobPage` 화면 진입 시 프론트엔드에서 쿼리 파라미터로 환경(env)을 담아 백엔드의 `/job-names` API를 호출.
3. **백엔드 중계 (GET):** 백엔드가 해당 환경의 Upstream 서버로 요청을 전달. 정상 응답 시 `[jobName, displayName]` 목록을, 예외 발생 시 기본 Fallback 데이터를 프론트엔드에 반환.
4. **작업 실행:** 사용자가 UI에서 파라미터를 입력하고 실행을 누르면 백엔드의 `/executions` API로 POST 요청 전송.
5. **백엔드 중계 (POST):** 백엔드가 Upstream 서버에 동일하게 POST를 날려 실제 배치 Job을 트리거하고 결과를 클라이언트에 전달.
