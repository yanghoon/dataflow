# Backstage Settings 플러그인 & Boot API 리팩토링 설계 스펙

## 목표
관리자가 시스템 설정을 조회하고 수정할 수 있도록 Backstage 프론트엔드와 Spring Boot 백엔드(Boot API)를 리팩토링한다. 기존 `@rjsf/core`(JSON Schema) 방식을 폐기하고, VSCode 설정 화면과 동일한 레이아웃(좌측 텍스트, 우측 컨트롤)의 직관적인 UI로 개편한다. 변경된 항목만 추출하여 업데이트하는 더티 플래그(Dirty Flag) 패턴을 도입하며, 백엔드와의 통신은 Backstage 표준 프록시(`DiscoveryApi`, `FetchApi`)를 경유한다.

## 설계 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 폼 렌더링 방식 | RJSF 폐기, 단순 List 반복 렌더링 | RJSF의 제약을 벗어나 VSCode 레이아웃을 정확히 구현하고, 상단 검색(Key/Label 필터링) 기능을 쉽게 제공하기 위함. |
| 통신 방식 | Backstage Proxy (`DiscoveryApi` + `FetchApi`) 경유 | Backstage 프레임워크 표준. 프록시를 통해 Boot API의 `/api/platforms/configs`와 통신. |
| 업데이트 전략 | 더티 플래그 (Dirty Flag) 기반 부분 업데이트 | 로컬 상태에서 변경이 발생한 항목만 `isDirty=true`로 마킹한 뒤, 저장 시 해당 항목들만 추려 `PATCH`로 일괄 부분 업데이트를 수행해 네트워크 낭비를 줄임. |
| 실패/재시도 | 자동 재시도 없음, 폼 상단에 Alert 노출 | 에러를 관리자가 인지하고 직접 닫거나 수동으로 재시도할 수 있도록 화면 유지. |

## 상세 구현 설계 (클래스 및 메소드 레벨)

### 1. Spring Boot 백엔드 (Boot API - `ingestion` 프로젝트)
- **DTO 및 Enum 정의**
  - `enum SettingType { STRING, NUMBER, BOOLEAN, SELECT }`
  - `class SettingOptionDto { String label; String value; }`
  - `class SettingItemDto {`
      - `String key;` *(예: "batch.scheduler.enabled")*
      - `SettingType type;`
      - `String label;`
      - `String description;`
      - `Object value;`
      - `List<SettingOptionDto> options;`
      - `String group;`
  - `}`
- **Controller (`SettingsController`)**
  - `@GetMapping("/api/platforms/configs")`: 전체 `List<SettingItemDto>` 반환
  - `@PatchMapping("/api/platforms/configs")`: 클라이언트에서 보낸 **변경분(더티 플래그가 켜진 항목들)** 리스트만 받아 DB 일괄(Batch) 업데이트 수행

### 2. Backstage 프론트엔드 타입 정의 (`src/api/types.ts`)
- `export type SettingType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'SELECT';`
- `export interface SettingOption { label: string; value: string; }`
- `export interface SettingItem {`
  - `key: string;`
  - `type: SettingType;`
  - `label: string;`
  - `description?: string;`
  - `value: any;`
  - `options?: SettingOption[];`
  - `group?: string;`
- `}`
- `export type DirtySettingItem = SettingItem & { isDirty: boolean; originalValue: any; };` *(로컬 렌더링용 확장 타입)*

### 3. Backstage 프론트엔드 API 클라이언트 (`src/api/SettingsApiClient.ts`)
- **Constructor**: `discoveryApi`, `fetchApi` 주입
- **`getConfigs(): Promise<SettingItem[]>`**
  - `discoveryApi.getBaseUrl('proxy')`를 통해 획득한 URL로 GET 호출
- **`updateConfigs(items: SettingItem[]): Promise<void>`**
  - 변경된 항목들만 배열로 받아 `PATCH {proxyUrl}/api/platforms/configs` 통신 수행. 실패 시 에러 throw.

### 4. UI 컴포넌트 (`src/components/SettingsPage/SettingsPage.tsx`)
- **상태 관리**: `useApi`로 가져온 배열을 `DirtySettingItem[]` 로컬 상태로 맵핑(초기 `isDirty: false`). 검색어 관리를 위한 `searchText` 상태 추가.
- **렌더링 로직 (VSCode 설정 레이아웃)**:
  1. **검색바**: 상단에 검색창 배치. `searchText`에 따라 리스트 필터링 (`key` 또는 `label` 포함 여부).
  2. **리스트 행(Row)**:
     - 좌측 영역: `label` (굵게) 및 `description` (작게)
     - 우측 영역: `type`에 따라 Switch, Select, TextField 렌더링.
     - `isDirty`가 true일 경우 좌측에 별표(*) 등 미저장 수정 상태 시각적 인디케이터 표시.
- **액션**: 변경 발생 시 로컬 상태의 `value`를 업데이트하고 `isDirty=true` 마킹.
- **저장 로직**: 하단 [저장] 버튼 클릭 시 `items.filter(i => i.isDirty)`로 필터링된 배열만 `settingsApi.updateConfigs`로 전송. 성공 시 모든 더티 마크 해제.

## 완료 조건 (자가검증)
- [ ] 컴파일/빌드 통과 (Backstage 플러그인 및 Spring Boot)
- [ ] 유닛테스트 (`SettingsPage.test.tsx`):
  - 텍스트 입력 시 검색 결과가 실시간으로 필터링되는지 검증.
  - 필드 변경 시 상태가 더티(dirty)로 전환되고 시각적 인디케이터가 표시되는지 검증.
  - 저장 시 더티 플래그가 켜진 항목만 API 클라이언트로 전달되는지 검증.
- [ ] 통합테스트 (`SettingsPage.integration.test.tsx`):
  - MSW로 `/proxy/api/platforms/configs` 모킹 및 `DiscoveryApi/FetchApi` 결합 경로 검증.
