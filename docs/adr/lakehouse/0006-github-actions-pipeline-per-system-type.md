---
status: accepted
date: 2026-11-27
---

# Lakehouse 정기 실행은 System Type마다 GitHub Actions 호출 파일 하나와 공통 재사용 워크플로 하나로 하고, 연결 정보는 gh 시크릿·변수에 둔다

`pipeline/<system_type>/*.sql`(silver → gold → 검사)을 정기로 돌릴 곳이 필요하다. 수집(원천 → bronze)은 Kestra와 Airbyte가 맡으므로, Actions는 변환만 돌리고 bronze는 만들지 않는다(`_sample/`은 돌리지 않는다).
실행 로직은 `.github/workflows/_lakehouse-pipeline.yml`(`workflow_call`) 하나에만 두고, System Type마다 `lakehouse-<system_type>.yml`이 트리거와 설정만 가진다. System Type마다 원천 주기가 달라 스케줄·수동 재실행·실패를 따로 다뤄야 하므로, matrix 하나로 묶지 않았다.
연결 정보(S3, Postgres)는 Airflow connection처럼 gh 저장소 시크릿(비밀 값)과 변수(나머지)에 한 번 등록하고, 파이프라인 설정(`DATA_ROOT`, `INIT_FILES`)은 호출 파일의 `env` 입력에 두어 Git으로 리뷰한다. 같은 키는 `env` 입력이 gh 값을 덮고, 둘 다 없으면 `base.sql` 기본값(로컬 디스크)으로 돈다.

## Considered Options

- **matrix 워크플로 하나**: cron이 하나라 System Type별 주기를 줄 수 없고, 하나만 다시 돌리기 번거롭다.
- **`.env` 통째를 시크릿 하나로**: 로컬과 같은 모양이지만 값을 확인할 수 없고 키 하나를 바꿀 때도 통째로 다시 써야 한다.
- **모든 설정을 gh 변수로**: 한 곳이지만 System Type마다 다른 대상을 줄 수 없고 변경이 리뷰되지 않는다.
- **호스티드 러너**: 사내 S3·Postgres에 닿지 않는다. self-hosted 러너(DuckDB CLI 설치)를 쓴다.

## Consequences

- 호출 파일의 `env:` 키는 재사용 워크플로로 넘어가지 않는다(GitHub 제약). 그래서 `env`를 여러 줄 문자열 입력으로 넘기고, 재사용 워크플로가 `KEY=VALUE` 줄을 export한다. 값에 따옴표를 쓰지 않는다.
- `concurrency`는 대기 자리가 하나뿐이다. 실행 중에 두 번 더 들어오면 먼저 기다리던 실행이 취소된다.
- 스케줄은 호출 파일에 주석으로만 두고, 필요할 때 사람이 푼다.
- 저장소가 public이라 self-hosted 러너에는 `self-hosted` 라벨을 쓰는 어떤 워크플로든 돌 수 있다(GitHub는 public 저장소에 self-hosted 러너를 권하지 않는다). 이 위험을 감수하고, 대신 세 가지를 지킨다: `pull_request` 트리거 워크플로를 self-hosted 러너에서 돌리지 않는다, 포크 PR 워크플로는 승인 후에만 돈다(저장소 설정), 시험 기간에는 러너를 서비스가 아니라 앞에서(`./run.sh`) 필요할 때만 켠다.
- `workflow_dispatch`는 워크플로가 기본 브랜치에 있어야 실행된다. 그래서 `main`에 머지하기 전에는 기능 브랜치에 임시 `push` 트리거를 두고 시험한다. 시험 순서는 A(실행 스크립트만 로컬) → C(기능 브랜치 push로 GitHub 러너) → B(act 로컬) → D(`main` 머지 후 수동 실행)이고, C부터는 사람이 동의한 뒤 진행한다(가이드 8장).
- 운영 절차: `lakehouse/docs/github-actions.md`.
