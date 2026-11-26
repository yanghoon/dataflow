# Airbyte를 ingestion pipeline의 핵심 인프라로, Vector를 push 수신 채널로 둔다

비개발자가 화면에서 신규 수집을 등록하고 운영할 수 있어야 하므로, Airbyte(bounded pull)를 ingestion pipeline의 핵심 인프라로 선정한다.
push 방식의 ingestion channel은 Vector(unbounded)를 별도로 도입해 지원한다.

## Status

Proposed (2026-11-12). 검토 단계.
2026-11-27 논의로 bounded/unbounded 정의, 요구사항, 후보 평가, 결정 근거를 보강했다(부록 A-2).

## Context

### 전송 모델

모든 데이터 전송은 하나의 능동 프로세스가 한 저장소에서 데이터를 읽어 다른 저장소에 쓰는 과정이다.
여기서 저장소는 데이터를 보존하고 요청에 응답하는 시스템이며, 메모리 버퍼, 파일, Database, API가 모두 이에 해당한다.

### pull과 push

- **pull**: 능동 프로세스가 도착지 쪽 시스템에 속한다. 수집기가 언제 무엇을 읽을지 결정하고(trigger), 소스 저장소에 읽기 요청을 보내 데이터를 가져온다. 소스는 요청에 응답할 뿐이므로, 이벤트를 발행하지 않는 외부 시스템에서도 수집할 수 있다.
- **push**: 능동 프로세스가 출발지 쪽 시스템에 속한다. 송신 측이 전송 시점을 결정하고 도착지 저장소에 데이터를 써넣는다. 수신 측은 데이터가 언제 도착할지 알 수 없으므로 항상 수신 가능한 상태로 떠 있어야 한다. 수신 측은 송신 측에 재전송을 요청할 수 없다. 구독형 연결도 연결 이후의 전송 시점을 송신 측이 결정하므로 push에 해당한다.

pull과 push는 연결 방식이나 프로토콜이 아니라 trigger를 누가 갖는지로 구분한다.
읽은 위치(state)를 누가 보존하는지는 방향과 무관하며, 장애 이후 재개할 수 있는지를 결정한다.

### bounded와 unbounded

- **bounded**: 실행마다 유한한 조각을 처리하고 종료하는 실행 방식이다. 이전 위치부터 실행 시점까지 읽고 종료하며, 커서로 조각을 이어 계속 생성되는 데이터도 커버한다. 대표적으로 batch job이 이에 해당한다.
- **unbounded**: 종료하지 않고 상시 동작하는 실행 방식이다. 데이터가 발생하는 즉시 읽거나 수신한다.

bounded와 unbounded는 실행 방식의 특성이며, pull/push와는 독립적인 축이다.
데이터 자체가 유한한지(bounded data)는 이 축과 다르다. Airbyte 증분 수집은 끝없이 쌓이는 데이터를 bounded 실행으로 반복해 읽는 경우다.

- pull은 두 방식 모두로 구현할 수 있다. 예를 들어 WAL을 상시 읽는 CDC는 unbounded pull이다.
- push를 수신하려면 상시 동작해야 하므로 수신 스텝은 unbounded가 필수적이다.
- 수신 스텝이 S3·Kafka에 쌓은 데이터를 이후에 읽는 것은 별개의 전송이며, 그 전송의 방식은 따로 정한다.
- 수신 프로세스가 내부 버퍼를 계속 flush해 S3에 쓰는 것은 unbounded push다. 묶어서 쓰는 것(batching)은 쓰기 단위이지 bounded가 아니다.

bounded pull은 다음 조건에서 다른 조합보다 유리하다.

- 소스가 데이터를 보존해 다시 읽을 수 있다.
- 수집 주기만큼의 지연을 허용한다.
- 재시도, backfill, 전체 스냅샷 재실행이 중요하다.
- 실행할 때만 리소스를 쓴다.

### 요구사항

- 수집 대상 source는 대부분 변경할 수 없고, 데이터 변경을 외부로 전달하지 않는다. 그래서 수집은 대부분 pull이다.
- pull 소스는 인증과 읽기 방식이 다양해 설정 유지보수 난이도가 높다.
- 비개발자가 화면에서 신규 수집을 등록하고 운영한다. 운영에는 실행 상태 확인, 재실행, 인증·설정 변경이 포함된다. 커넥터 개발은 개발자가 맡고 이 요구의 대상이 아니다.
- 일부 source는 데이터를 push로만 보낸다. 그래서 상시 가용하고 유실을 막는 수신기가 필요하다.

### Vector와 Airbyte의 대상

- **Vector**: 소스의 보존성이 낮고, 이벤트가 지속적으로 발행되며, 실시간성이 요구되는 텔레메트리 환경을 대상으로 한다. 이를 위해 unbounded pull/push 구조를 택해 유실을 방지하고 실시간성을 확보했다.
- **Airbyte**: 보존성이 높고 이벤트를 발행하지 않는 외부 시스템을, 실시간성 요구가 낮은 분석 용도로 수집한다. 따라서 bounded pull(batch) 구조를 택했다.

또한 연동 대상 소스마다 인증과 읽기 방식이 다양하다.
그래서 Airbyte에는 커넥터 확장성과 복잡한 설정을 관리하는 화면이 필수적이었다.
Vector는 표준화된 텔레메트리 소스를 주로 다루기 때문에, 확장성보다는 데이터 전송 성능과 안정성에 초점을 맞춰 발전했다.

### 후보 평가 (2026-11-17)

| 후보 | 비개발자 신규 등록 | 유지보수 | 리소스 | 라이선스 | pull / push |
|---|---|---|---|---|---|
| **Airbyte** | ○ 커넥터 spec으로 양식 화면 자동 생성 | 커넥터 이미지 미러링(에어갭), 플랫폼 업그레이드 | 큼. sync마다 pod, DB 커넥터 기본 2 CPU·2GB | ELv2. 사내 사용 제약 없음 | pull |
| NiFi | ✗ processor를 엮어야 함 | NAR 내장(에어갭 유리). REST 처리 조립, JVM·디스크 저장소 관리 | 큼. 최소 4코어·heap 4GB(Cloudera 권장) | Apache 2.0 | pull / push |
| Kestra + dlt | ✗ YAML·코드 필요. 실행·재실행 화면은 있음 | 낮음. `plugin-dlt` 공식 지원 | 중간. Kestra + Postgres | Apache 2.0 | pull |
| **Vector** | 해당 없음 | 낮음. 단일 바이너리 | 매우 작음 | MPL-2.0 | push 수신 강함, pull 약함 |

- pull과 push를 하나로 지원하는 후보는 NiFi다. NiFi는 비개발자 신규 등록 요구를 충족하지 못한다.
- 비개발자 신규 등록 요구를 충족하는 pull 후보는 Airbyte뿐이다.

## Decision

- pull은 Airbyte를 핵심 인프라로 한다. 비개발자가 Airbyte 화면에서 신규 수집을 등록하고 운영한다. 새 소스용 커넥터는 개발자가 만든다.
- push 방식의 ingestion channel은 Vector를 별도로 도입한다. Vector는 가용성, 로컬 버퍼링, 성능을 기준으로 선정한다.
- Airbyte의 리소스 비용과 에어갭 이미지 미러링 비용은 감수한다.

## 미확정 항목

- 비개발자 신규 등록 요구의 근거: 예정된 소스 목록과 신규 등록 빈도. 이 요구가 무너지면 결정도 무너진다.
- 에어갭에서 Airbyte 기성 커넥터로 붙는 소스의 비율.
- [ADR-0005](./0005-kestra-pull-ingestion-instead-of-airbyte.md)와의 관계: ADR-0005는 "운영자 양식 화면 요구가 생기면 Airbyte를 다시 검토한다"는 전환 조건을 두었다. 이 ADR은 그 조건이 충족된 것으로 본다. ADR-0005를 대체할지는 이 ADR을 Accepted로 올릴 때 정한다.

## 참고

- [개발자를 위한 데이터 도구 지형 가이드](https://sinja.io/blog/data-landscape-guide-for-developers) ([GeekNews](https://news.hada.io/topic?id=31899)): 수집 도구(Fivetran·Airbyte·dlt)를 같은 범주로 보고, 오케스트레이터(Airflow·Dagster·Prefect)는 배치 중심이라 상시 스트림에 부적합하다고 정리한다.
- [Airbyte scaling](https://docs.airbyte.com/operator-guides/scaling-airbyte/), [Airbyte connector resources](https://docs.airbyte.com/platform/operator-guides/configuring-connector-resources)
- [NiFi sizing (Cloudera)](https://docs.cloudera.com/cfm/latest/nifi-sizing/topics/cfm-sizing-recommendations.html), [NIFI-10757](https://issues.apache.org/jira/browse/NIFI-10757)
- [Kestra plugin-dlt](https://kestra.io/plugins/plugin-dlt)
- [Dataflow Model 논문(VLDB 2015)](https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf): bounded/unbounded를 데이터 성질로, batch/streaming을 실행 방식으로 구분한다.

## 부록 A. 검토 기록 (2026-11-12)

요청: "airbyte와 vector의 차이에 대해 아래의 문장 검토해줘." 대상 문장은 부록 B 원문이다.

- **push 수신과 unbounded**: "push를 수신하려면 unbounded 처리가 필수"가 과하다는 지적이 있었다(수신 후 S3·Kafka에 받아 bounded pull로 처리 가능). 철회했다. 전송 모델상 한 번의 전송은 능동 프로세스 하나가 읽고 쓰는 구간이고, push 구간은 소스에서 보낸 데이터를 받는 수신부다. 수신부는 상시 떠 있어야 하므로 unbounded가 맞다. 이후 전송은 별개의 전송이며, 그 구간의 유실은 buffering으로 막는다. 원문을 유지한다.
- **Vector의 유실 방지 근거**: "unbounded 구조로 유실 방지"의 인과가 빠졌다는 지적이 있었다. 읽는 구간(소스 보존성이 낮아 즉시 읽어야 함)으로 읽으면 맞고, 후속 전송의 buffering과는 층위가 다르다. 판단이 애매해 원문을 유지한다.
- **결론의 전제**: 우리 소스가 고보존·저실시간이라는 요구를 결론 앞에 명시하자는 의견은 사소한 것으로 보고 반영하지 않았다.
- **Airbyte와 이벤트**: Airbyte도 CDC로 WAL을 읽으므로 "이벤트를 발행하지 않는"보다 "외부에서 조회 가능한"이 정확하다는 의견은 반영하지 않았다.
- **오타**: 요규 → 요구, 당양한 → 다양한. 본문에 반영했다.
- **ADR-0005와의 관계**: [ADR-0005](./0005-kestra-pull-ingestion-instead-of-airbyte.md)(pull 수집을 Kestra로 시작, Accepted)와 결론이 겹친다. 관계는 이 ADR을 Accepted로 올릴 때 정한다.

## 부록 A-2. 검토 기록 (2026-11-27)

- **push 수신은 bounded가 가능한가**: 불가하다. 수신 스텝은 항상 unbounded다. S3에 쌓은 이후의 처리는 독립된 다른 스텝이다. 부록 A의 판단을 유지한다.
- **버퍼링 후 flush**: 같은 프로세스가 버퍼를 계속 flush하면 unbounded push다. 별도 job이 실행 후 종료할 때만 bounded다.
- **bounded/unbounded 정의**: 원문은 데이터 성질과 실행 방식을 섞었다. 표준 용어(Dataflow Model, Flink)는 bounded/unbounded를 데이터 성질로, batch/streaming을 실행 방식으로 쓴다. 이 ADR은 bounded/unbounded를 실행 방식으로 명시하는 안을 택했다.
- **push/pull 특성 서술**: "push는 전송 상태를 source가 결정"은 state가 방향과 무관하다는 본문과 충돌해 쓰지 않는다. "push는 재시도가 어렵다"는 "수신 측이 재전송을 요청할 수 없다"로 바꾼다.
- **통합 도구 배제 근거**: "pull·push 통합 도구는 수가 적고 유지보수가 안 된다"는 사실과 다르다(NiFi는 활발히 유지된다). NiFi는 비개발자 신규 등록 요구를 충족하지 못해 배제한다.
- **요구사항 확정**: 비개발자 운영은 신규 수집 등록까지 포함한다. 커넥터 개발은 대상이 아니다. 이 요구로 Airbyte가 유일한 pull 후보가 된다.
- **억지 결론 여부**: 결론은 ADR-0005의 전환 조건과 일관된다. 다만 결론을 요구사항 하나가 정하므로, 그 요구의 근거(미확정 항목)를 보강해야 한다.

## 부록 B. 원문

> 모든 데이터 전송은 하나의 능동 프로세스가 한 저장소에서 데이터를 읽어 다른 저장소에 쓰는 과정이다. 여기서 저장소는 데이터를 보존하고 요청에 응답하는 시스템이며, 메모리 버퍼, 파일, Database, API가 모두 이에 해당한다.
>
> pull은 능동 프로세스가 도착지 쪽 시스템에 속하는 방식이다. 수집기가 언제 무엇을 읽을지 결정하고(trigger), 소스 저장소에 읽기 요청을 보내 데이터를 가져온다. 소스는 요청에 응답할 뿐이므로, 이벤트를 발행하지 않는 외부 시스템에서도 수집할 수 있다.
>
> push는 능동 프로세스가 출발지 쪽 시스템에 속하는 방식이다. 송신 측이 전송 시점을 결정하고 도착지 저장소에 데이터를 써넣는다. 수신 측은 데이터가 언제 도착할지 알 수 없으므로 항상 수신 가능한 상태로 떠 있어야 한다. 구독형 연결도 연결 이후의 전송 시점을 송신 측이 결정하므로 push에 해당한다.
>
> pull과 push는 연결 방식이나 프로토콜이 아니라 trigger를 누가 갖는지로 구분한다. 읽은 위치(state)를 누가 보존하는지는 방향과 무관하며, 장애 이후 재개할 수 있는지를 결정한다.
>
> bounded는 시작과 끝이 정의된 데이터를 처리하는 방식이다. 수집은 이전 위치부터 실행 시점까지의 유한한 조각을 읽고 종료되며, 커서로 조각을 이어 전체 데이터를 커버한다. 대표적으로 batch job이 이에 해당한다.
>
> unbounded는 끝이 없이 계속 생성되는 데이터를 처리하는 방식이다. 수집 프로세스는 종료되지 않고 상시 동작하며, 데이터가 발생하는 즉시 읽거나 수신한다.
>
> bounded와 unbounded는 데이터와 처리 방식의 특성이며, pull/push와는 독립적인 축이다. pull은 두 방식 모두로 구현할 수 있지만, push를 수신하려면 상시 동작해야 하므로 unbounded 처리가 필수적이다.
>
> vector는 소스의 보존성이 낮고, 이벤트가 지속적으로 발행되며, 실시간성이 요구되는 텔레메트리 환경을 대상으로 한다. 이를 위해 unbounded pull/push 구조를 택해 유실을 방지하고 실시간성을 확보했다.
>
> 반면 airbyte는 보존성이 높고 이벤트를 발행하지 않는 외부 시스템을, 실시간성 요구가 낮은 분석 용도로 수집한다. 따라서 bounded pull(batch) 구조를 택했다.
>
> 또한 연동 대상 소스마다 인증과 읽기 방식이 다양하다. 그래서 airbyte에는 커넥터 확장성과 복잡한 설정을 관리하는 화면이 필수적이었다. vector는 표준화된 텔레메트리 소스를 주로 다루기 때문에, 확장성보다는 데이터 전송 성능과 안정성에 초점을 맞춰 발전했다.
>
> 이에 따라 다양한 시스템의 데이터 저장소를 수집하기 위한 확장성과 인프라 운영자를 위한 관리 기능을 고려하여, airbyte를 ingestion pipeline의 핵심 인프라로 선정한다. 그리고 push 방식의 ingestion channel을 지원하기 위해 vector를 별도로 도입한다.
