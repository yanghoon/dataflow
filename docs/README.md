# 워크플로우 디자인

## Concept
- **Workflow (How)**
  - 단일 수집 프로세스 로직을 구현하는 POJO 클래스
  - 동일한 Workflow 로직이 서로 다른 소스/타겟 설정을 가진 여러 WorkflowJob에서 사용됨

- **WorkflowJob (Where/When)**
  - 개별 수집 배치에 대한 설정(소스, 타겟, cron 스케줄 등)
  - name으로 유일하게 구분되됨, workflowType과 일치하는 Workflow를 실행
  - 저장소 구현에 따라 변경 가능 (yaml, database)

- **Scheduler**
  - 외부 트리거 메커니즘. Scheduler 종류에 관계 없이 WorkflowJob 트리거 가능
  - **db-scheduler**
    - DB 테이블 하나로 클러스터 안전한 스케줄링과 중복 실행 방지를 제공하는 경량 라이브러리
    - Task는 실행 로직을 담은 자바 객체로 메모리(JVM)에만 존재
    - TaskInstance는 DB row로 영속화된 독립 실행 단위이자 자신만의 스케줄을 포함하며, WorkflowJob 하나와 1:1 대응됨
  - **CronJob (Kubernetes)**
    - 스케줄과 Pod 실행 템플릿을 하나의 리소스에 함께 담는 K8s 오브젝트. 실행 시점에 Job 리소스가 생성됨
    - 수집 프로세스 별로 컨테이터를 개발하거나, 외부 어플리케이션을 호출하는 방식으로 동작
    - 개별 스케줄이 독립적인 컨테이너로 동작하여, 자원 격리 및 분산이 가능함
    - 스케줄 최소 단위는 1분이며, 중앙화된 동시성 제어가 없어 별도 애플리케이션 레벨 방어 로직이 필요함
