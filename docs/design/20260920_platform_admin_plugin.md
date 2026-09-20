# Platform Admin 프론트엔드 연동 설계 스펙

## 목표
Backstage 최신 소스(New Frontend System) + Spring Boot 백엔드 연동을 위한 최소 구성 구축.
프록시 엔드포인트 1개(`/spring-platform`), 프론트엔드 플러그인 1개(`platform-admin`), 페이지 2개(`tools`, `sites`) 구성. (Spring Boot 구현은 범위 제외)

## 배경 / 기존 컨텍스트
- 참조한 기존 패턴: `@backstage/plugin-proxy-backend` 및 New Frontend System의 `createFrontendPlugin`, `PageBlueprint` 패턴.
- 신규로 가는 이유: Spring Boot 서비스(`/api/v1/platform/...`)의 API들을 Backstage 통합 UI에서 제공하기 위함.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 배달 보장 | N/A (프론트엔드 뷰어/HTTP Get 요청) | 상태 변경 없는 단순 조회용 최소 구성 |
| 동시성 제어 | N/A | 프론트엔드 단일 렌더링 |
| 실패/재시도 | `useAsync` 에러 캐치 후 단순 Error 메시지 렌더링 | 최소 구성 가이드라인 준수 |
| 데이터 모델 | `tools`, `sites` 모두 3개 필드(`slug`, `name`, `status`) 노출 | 임시 공통 스키마 및 "일단 3개만" 요구사항 반영 |
| 파라미터 시간 결합 | 없음 (모든 파라미터는 명시적 경로로 분리) | 고정된 API 경로(`/tools`, `/sites`) 연동 |
| 프록시 대상 | `http://localhost:8080` (인증 헤더 설정은 주석 처리) | 로컬 개발 환경용, 인증 불필요 |

## 완료 조건 (자가검증)
- [ ] `app-config.yaml` 프록시 엔드포인트(`/spring-platform`) 설정 및 인증 주석 처리
- [ ] `yarn new` 를 통한 `platform-admin` 플러그인 생성 및 템플릿 코드 작성
- [ ] Backstage App (`packages/app`) 에 플러그인 의존성 추가
- [ ] 컴파일/빌드 통과 (`yarn dev` 성공)
- [ ] 로컬 환경 구동 시 UI 메뉴(`Platform Tools`, `Platform Sites`) 및 테이블 노출 확인
- [ ] 유닛테스트/통합테스트: 제외 (최소 구성 스캐폴딩 우선)
- [ ] 커버리지 기준: N/A

## 미결 사항
없음 (타겟 포트 변경 필요 시 사용자가 직접 `app-config.yaml` 수정 예정)
