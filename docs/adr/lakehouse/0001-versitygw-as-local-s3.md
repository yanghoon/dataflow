---
status: accepted
date: 2026-11-16
---

# 로컬 S3는 versitygw(posix)로 두고, 버킷 `local` = `lakehouse/s3-local/` 폴더로 쓴다

로컬 개발과 시험에서 Kestra, Airbyte(S3 목적지), DuckDB가 같은 S3에 쓰고 읽어야 하고, 그 내용을 로컬 SQL이 디스크에서 바로 읽을 수 있어야 한다. 그래서 S3 객체를 일반 파일로 저장하는 versitygw posix 백엔드를 쓴다. 버킷 `local`이 `lakehouse/s3-local/`을 가리키게 해서, `s3://local/bronze/...`에 쓴 파일이 `lakehouse/s3-local/bronze/...`에 그대로 보이게 한다. MinIO는 이 환경에서 이미지를 받을 수 없었다.

## Considered Options

2026-11-15 `kestra/ingest` compose에서 `s3` 서비스만 바꿔 끼워 같은 시험을 돌렸다: 버킷 생성과 틀린 키 거부, Kestra 흐름 3개(Gerrit, GHES, PG) 업로드, aws-cli 20MB 분할 업로드(CRT, classic), 실버 `run.sh`(DuckDB가 S3를 읽고 씀), 재기동 뒤 데이터 유지, 메모리(`docker stats`, 시험 직후).

| 후보 | 결과 | 메모리 | 폴더에 파일이 그대로 보임 | 설정 |
|---|---|---|---|---|
| **versitygw** | 전 단계 통과, `verify.sh` 19/20 | 13MiB | 예 | 실행 인자 한 줄, 기존 키 그대로 |
| Garage v2.1.0 | 전 단계 통과 | 5MiB | 아니오(자체 형식으로 쪼개 저장) | 기동 뒤 layout·key·bucket 명령, 키 형식 `GK…` 강제 |
| rclone serve s3 | 조건부: aws-cli CRT 분할 업로드 실패 | 23MiB | 예 | 간단. 공식 문서가 실험적 기능이라고 밝힘 |
| s3proxy | 조건부: aws-cli CRT 분할 업로드 실패 | 113MiB | 예 | Java라 무거움 |
| moto | 탈락: Kestra 업로드 실패(HTTP 100 응답), 인증 검사 없음, 재기동하면 데이터 사라짐 | 55MiB | 아니오 | |
| SeaweedFS(이전) | `verify.sh` 20/20 | 212MiB | 아니오 | `s3.json`과 버킷 생성 컨테이너 필요 |

- versitygw `verify.sh`의 실패 1건은 백필 항목이다. 결과 파일 6개는 맞는 폴더에 있었고, 검증 스크립트가 실행 목록을 100개까지만 조회해서 백필 실행을 못 찾았다. S3 문제가 아니다.
- Garage는 가장 가볍지만 파일이 폴더에 그대로 남지 않아 이 결정의 핵심 조건을 못 맞춘다.

## Consequences

- 운영 S3를 대신하지 않는다. 버전 관리, 정책, 서버 쪽 암호화 같은 기능은 시험하지 않는다.
- 2026-11-17 `kestra/ingest/compose.yaml`의 `s3` 서비스를 versitygw로 바꾸고 `lakehouse/s3-local/`을 `/data/local`로 마운트했다. SeaweedFS 설정(`s3/s3.json`)은 지웠다.
- macOS 폴더 마운트는 xattr를 지원하지 않아 `local` 버킷 조회가 실패한다(`get acl: operation not supported`). 그래서 메타데이터는 `--sidecar /meta`(named volume)에 따로 둔다.
