# Gerrit Airbyte Ingestion

Gerrit Code Review 인스턴스로부터 계정, 프로젝트, 그룹 데이터를 추출하여 로컬 데이터 레이크 파이프라인(S3)으로 적재하는 컨텍스트.

## Language

**Gerrit Account**:
Gerrit 시스템에 등록된 고유 사용자 엔티티로 기본 키는 `_account_id`를 사용함.
_Avoid_: User, Member, MemberInfo

**Gerrit Project**:
Gerrit이 관리하는 개별 Git 저장소 메타데이터 엔티티로 응답 맵의 키가 프로젝트 이름이 됨.
_Avoid_: Repository, Repo

**Gerrit Group**:
접근 제어 및 권한 부여 단위인 내부/외부 그룹 엔티티.
_Avoid_: Team, Role

**XSSI Magic String**:
Cross-Site Script Inclusion 공격을 방어하기 위해 Gerrit REST JSON 응답 선두에 삽입되는 5바이트 문자열(`)]}'\n`).
_Avoid_: Magic Bytes, Header String

**Terminal Stream Status**:
Airbyte 동기화 프로토콜에서 각 스트림 데이터 판독이 정상 완료되었음을 나타내는 최종 상태 추적 메시지(`STREAM_STATUS: COMPLETE`).
_Avoid_: Stream Done, Finished Message

**Containerd Direct Import**:
Kind 클러스터(`airbyte-abctl-control-plane`) 노드의 containerd(`k8s.io` 네임스페이스)로 로컬 이미지를 직접 주입하는 배포 방식.
_Avoid_: kind load, registry push
