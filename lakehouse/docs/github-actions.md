# GitHub Actions로 Lakehouse 파이프라인 돌리기

`pipeline/<system_type>/*.sql`(silver → gold → 검사)을 self-hosted 러너에서 수동 또는 스케줄로 실행한다. 결정과 이유는 [ADR lakehouse/0006](../../docs/adr/lakehouse/0006-github-actions-pipeline-per-system-type.md)에 있다.

**상태: 작성만 했고 실행하지 않았다(2026-11-27).**

| 파일 | 역할 |
|---|---|
| `.github/workflows/_lakehouse-pipeline.yml` | 공통 실행 로직(`workflow_call`). 직접 실행하지 않는다 |
| `.github/workflows/lakehouse-<system_type>.yml` | System Type 하나의 트리거와 설정. 지금은 `jaffle_shop`만 있다 |

모든 `gh` 명령은 저장소 폴더에서 실행한다(`gh auth status`로 로그인 확인). 저장소는 `yanghoon/dataflow`다.

## 1. 미리 알아 둘 것

> **WARNING:** 워크플로는 bronze를 만들지 않는다. 실행 전에 bronze가 대상 위치(`DATA_ROOT`)에 있어야 한다. 없으면 silver 단계가 실패한다(4장).

> **NOTE:** 환경 변수는 아래 순서로 읽고, 나중 것이 이긴다.
> 1. `pipeline/_init/*.sql`의 기본값. 아무 값도 없으면 로컬 디스크(`lakehouse/s3-local`)로 돈다.
> 2. gh 저장소 시크릿과 변수(연결 정보, 3장).
> 3. 호출 파일 `lakehouse-<system_type>.yml`의 `env` 입력(5장).

## 2. self-hosted 러너 준비

### 2.1 DuckDB CLI 설치

러너 머신에 DuckDB CLI가 이미 있다고 본다. 없으면 설치한다.

```bash
# macOS
brew install duckdb
# macOS, Linux
curl https://install.duckdb.org | sh
sudo ln -sf ~/.duckdb/cli/latest/duckdb /usr/local/bin/duckdb   # 러너 서비스의 PATH 에서도 보이게 한다
duckdb --version
```

> **CAUTION:** 러너를 서비스로 돌리면 로그인 셸의 PATH를 읽지 않는다. `duckdb`가 `/usr/local/bin`처럼 서비스 PATH에 있는 폴더에 있어야 한다. 아니면 러너 폴더의 `.path` 파일에 그 폴더를 더하고 서비스를 다시 시작한다.

DuckDB는 실행 중에 `httpfs`, `postgres` 확장을 내려받는다. 인터넷이 막힌 머신이면 확장을 미리 설치한다.

### 2.2 러너 등록

```bash
REPO=yanghoon/dataflow
OS=linux    # macOS 는 osx
ARCH=x64    # Apple Silicon, ARM 은 arm64
V=$(gh release view --repo actions/runner --json tagName --jq '.tagName | ltrimstr("v")')

mkdir -p ~/actions-runner && cd ~/actions-runner
curl -fL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${V}/actions-runner-${OS}-${ARCH}-${V}.tar.gz"
tar xzf runner.tar.gz

# 등록 토큰은 1시간 동안만 쓸 수 있다
TOKEN=$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token)
./config.sh --url "https://github.com/$REPO" --token "$TOKEN" --name "$(hostname)-lakehouse" --unattended
```

서비스로 띄운다.

```bash
sudo ./svc.sh install && sudo ./svc.sh start   # Linux
./svc.sh install && ./svc.sh start             # macOS
```

시험 삼아 앞에서만 돌리려면 서비스 대신 `./run.sh`를 쓴다.

확인한다. `status`가 `online`이어야 한다.

```bash
gh api repos/yanghoon/dataflow/actions/runners --jq '.runners[] | {id, name, status, labels: [.labels[].name]}'
```

### 2.3 라벨(선택)

워크플로는 `runs-on: [self-hosted]`라 이 저장소의 아무 self-hosted 러너에서나 돈다. 특정 러너에서만 돌리려면 라벨을 붙인다.

- 등록할 때 붙이기: `./config.sh … --labels <label>`
- 등록한 뒤에 붙이기:

  ```bash
  gh api -X POST repos/yanghoon/dataflow/actions/runners/<id>/labels -f 'labels[]=<label>'
  ```

- 그다음 `_lakehouse-pipeline.yml`의 `runs-on` 줄을 주석에 있는 `runs-on: [self-hosted, <label>]`로 바꾼다.

## 3. 연결 정보 등록(시크릿, 변수)

S3와 Postgres 연결 정보는 저장소에 한 번 등록하고, 모든 System Type이 함께 쓴다. 쓰지 않는 연결은 등록하지 않는다.

비밀 값은 시크릿으로 등록한다. `--body` 없이 실행하면 값을 물어본다. 그래서 셸 이력에 값이 남지 않는다.

```bash
gh secret set S3_ACCESS_KEY_ID
gh secret set S3_SECRET_KEY_ID
gh secret set PG_PASSWORD
```

나머지는 변수로 등록한다. 빈 값은 기본값을 쓴다(`pipeline/.env.example`).

```bash
gh variable set S3_ENDPOINT  --body "s3.example.internal:7070"
gh variable set S3_REGION    --body "us-east-1"
gh variable set S3_URL_STYLE --body "path"
gh variable set S3_USE_SSL   --body "true"
gh variable set PG_HOST      --body "pg.example.internal"
gh variable set PG_PORT      --body "5432"
gh variable set PG_DATABASE  --body "gold"
gh variable set PG_USER      --body "writer"
```

확인한다.

```bash
gh secret list      # 이름과 바꾼 시각만 보인다
gh variable list    # 값까지 보인다
```

> **NOTE:** 시크릿 값은 다시 읽을 수 없다. 바꾸려면 같은 명령으로 다시 쓴다. 원본 값은 저장소 밖(비밀번호 관리 도구 등)에 둔다.

로컬에서 같은 연결로 돌리려면 `cp pipeline/.env.example pipeline/.env`로 만든다. 그다음 `gh variable list`의 값과 시크릿 원본 값을 `.env`에 쓴다.

## 4. bronze 먼저 만들기

워크플로는 `pipeline/<system_type>/*.sql`만 돌리고 `_sample/`은 돌리지 않는다. 실제 수집(Kestra, Airbyte)이 아직 없는 System Type은 `_sample`로 bronze를 먼저 만든다.

- **S3에서 돌릴 때:** 로컬에서 같은 `DATA_ROOT`와 S3 값을 `pipeline/.env`에 쓰고 bronze를 만든다.

  ```bash
  cd lakehouse
  mkdir -p source/jaffle_shop
  pipeline/run.sh pipeline/jaffle_shop/_sample/0*.sql
  ```

- **로컬 디스크(기본값)에서 돌릴 때:** 데이터는 러너 작업 폴더의 `lakehouse/s3-local`에 쓴다. 워크플로가 `clean: false`로 checkout하므로 실행 사이에 데이터가 남는다. 그 폴더에서 bronze를 만든다.

  ```bash
  cd ~/actions-runner/_work/dataflow/dataflow/lakehouse   # 러너를 한 번 돌린 뒤에 생긴다
  mkdir -p source/jaffle_shop
  pipeline/run.sh pipeline/jaffle_shop/_sample/0*.sql
  ```

> **CAUTION:** 러너 작업 폴더에 `lakehouse/pipeline/.env`를 두지 않는다. `run.sh`는 `.env`를 읽어 환경 변수를 덮는다. 그래서 1장의 우선순위가 깨진다. 워크플로는 이 파일이 있으면 실패한다. 위 명령은 `.env` 없이 돈다.

## 5. 파이프라인 설정(호출 파일의 `env`)

`DATA_ROOT`와 `INIT_FILES`처럼 "어느 연결을 쓰나"를 정하는 값은 호출 파일의 `env`에 쓴다. 연결 정보와 같은 키를 쓰면 gh 값을 덮는다.

```yaml
# .github/workflows/lakehouse-jaffle_shop.yml
    with:
      system_type: jaffle_shop
      env: |
        DATA_ROOT=s3://local
        INIT_FILES=pipeline/_init/pg.sql pipeline/_init/base.sql pipeline/_init/s3.sql
```

- 한 줄에 `KEY=VALUE` 하나를 쓴다. 값에 따옴표를 쓰지 않는다. 따옴표도 값에 들어간다.
- 빈 줄과 `#`으로 시작하는 줄은 건너뛴다. 모두 주석이면 로컬 디스크로 돈다.
- `INIT_FILES`는 쓴 순서대로 읽는다. `pg.sql`은 `base.sql`보다 앞에 쓴다.
- 호출 파일의 `env:` 키는 공통 워크플로로 넘어가지 않는다(GitHub 제약). 그래서 반드시 `with.env` 입력에 쓴다.

## 6. 실행

### 6.1 수동 실행

```bash
gh workflow run lakehouse-jaffle_shop.yml                    # 전체(*.sql)
gh workflow run lakehouse-jaffle_shop.yml -f files='2*.sql'  # 실버만
gh run list --workflow lakehouse-jaffle_shop.yml --limit 5
gh run watch          # 실행을 골라 끝날 때까지 본다
gh run view --log     # 로그
```

웹에서는 Actions → `lakehouse-jaffle_shop` → Run workflow로 실행한다.

### 6.2 스케줄

스케줄은 주석으로만 있다. 쓰려면 호출 파일에서 `schedule:` 두 줄의 주석을 풀고 `main`에 머지한다.

```yaml
  schedule:
    - cron: "0 18 * * *"   # UTC. 매일 KST 03:00
```

- cron은 UTC다. KST에서 9시간을 뺀다.
- GitHub는 스케줄 실행을 몇 분 늦게 시작할 수 있다. 기본 브랜치의 파일만 스케줄로 돈다.
- 멈추려면 다시 주석으로 바꾸거나 `gh workflow disable lakehouse-jaffle_shop.yml`을 쓴다. 다시 켤 때는 `gh workflow enable`을 쓴다.

### 6.3 겹칠 때

같은 System Type의 실행은 한 번에 하나만 돈다. 새 실행은 앞 실행이 끝날 때까지 기다린다.

> **CAUTION:** 대기 자리는 하나뿐이다. 실행 중에 두 번 더 들어오면 먼저 기다리던 실행이 취소되고, 마지막 것만 남는다.

## 7. System Type 더하기

1. `lakehouse-jaffle_shop.yml`을 `lakehouse-<system_type>.yml`로 복사한다.
2. `name`, `system_type`, `env`, `files` 설명을 바꾼다. 스케줄은 System Type마다 따로 정한다.
3. 새 연결이 필요하면 3장처럼 시크릿과 변수를 더한다. 이름이 기존 연결과 겹치면 `env`에서 덮는다.

> **NOTE:** 공통 워크플로가 읽는 연결 키 목록은 `_lakehouse-pipeline.yml`의 `jobs.run.env`에 있다. 새 키(예: 두 번째 S3)를 쓰려면 그 목록에 더한다.

## 8. 워크플로 시험하기

워크플로를 바꾸면 A → C → B → D 순서로 시험한다. 뒤로 갈수록 실제와 가깝고 준비가 크다. C부터는 저장소와 러너를 건드리므로 담당자의 동의를 받은 뒤 진행한다.

> **WARNING:** 이 저장소는 public이다. self-hosted 러너가 켜져 있으면 `self-hosted` 라벨을 쓰는 어떤 워크플로든 그 머신에서 돈다. 시험할 때만 러너를 켜고(8.2), `pull_request` 트리거 워크플로를 self-hosted 러너에서 돌리지 않는다. 포크 PR 워크플로는 승인 후에만 돌게 둔다(Settings → Actions → General → Fork pull request workflows).

| | 방법 | 확인되는 것 | 확인되지 않는 것 |
|---|---|---|---|
| A | 실행 스크립트만 로컬 | env 덮어쓰기, 입력 검사, SQL 실행 | yml 연결, 시크릿·변수, 러너 |
| C | 기능 브랜치 임시 `push` 트리거 | GitHub 실제 동작 전부(러너, 시크릿·변수, PATH, 작업 폴더) | 수동 실행 입력(`files`) |
| B | act 로컬 | yml 연결, 입력 전달 | `secrets: inherit`·`vars` 전달, `concurrency`, `clean: false`는 act 버전에 따라 다를 수 있다 |
| D | `main` 머지 후 `gh workflow run` | 운영과 같은 방식 전부 | 없음 |

### 8.1 A. 실행 스크립트만 로컬에서

공통 워크플로의 `Run pipeline` 스크립트를 꺼내 `lakehouse/`에서 돌린다. Ruby(macOS 기본)로 꺼낸다.

```bash
cd lakehouse
ruby -ryaml -e 'puts YAML.load_file("../.github/workflows/_lakehouse-pipeline.yml")["jobs"]["run"]["steps"][1]["run"]' > /tmp/step.sh

# 1) env 비움 → 로컬 디스크. 90_checks 의 ok 가 true
SYSTEM_TYPE=jaffle_shop FILES='*.sql' PIPELINE_ENV='' bash /tmp/step.sh
# 2) env 입력이 바깥 값(gh 변수 흉내)을 덮는다. DATA_ROOT=s3-local 이 출력된다
DATA_ROOT=from-gh SYSTEM_TYPE=jaffle_shop FILES='9*.sql' PIPELINE_ENV='DATA_ROOT=s3-local' bash /tmp/step.sh
# 3) 실패해야 하는 입력. 모두 exit 2
SYSTEM_TYPE='../x' FILES='' PIPELINE_ENV='' bash /tmp/step.sh
SYSTEM_TYPE=jaffle_shop FILES='9*.sql' PIPELINE_ENV='not a pair' bash /tmp/step.sh
SYSTEM_TYPE=jaffle_shop FILES='7*.sql' PIPELINE_ENV='' bash /tmp/step.sh
```

로컬 `s3-local`에 bronze가 있어야 한다(README 2~3). 1)은 로컬 silver·gold를 다시 쓴다.

### 8.2 C. 기능 브랜치에서 GitHub 러너로

`workflow_dispatch`는 워크플로가 기본 브랜치(`main`)에 있어야 실행된다. 머지 전에는 호출 파일에 임시 `push` 트리거를 두고 기능 브랜치에 push한다. push 실행은 push한 커밋의 워크플로 파일을 쓴다.

1. 러너를 등록한다(2.2). 서비스로 띄우지 않고 앞에서 켠다. 터미널 PATH를 그대로 쓰므로 `duckdb`를 찾는다.

   ```bash
   cd ~/actions-runner && ./run.sh      # 시험이 끝나면 Ctrl-C
   ```

2. 호출 파일에 임시 트리거를 더한다.

   ```yaml
   on:
     push:                       # 임시: 시험용. main 에 머지하기 전에 지운다
       branches: [<기능 브랜치>]
       paths: [".github/workflows/*lakehouse*", "lakehouse/pipeline/**"]
   ```

3. 커밋하고 기능 브랜치에 push한 뒤 실행을 본다.

   ```bash
   git push origin <기능 브랜치>
   gh run list --workflow lakehouse-jaffle_shop.yml --branch <기능 브랜치> --limit 3
   gh run watch <run-id>
   gh run view <run-id> --log
   ```

4. 첫 실행은 러너 작업 폴더에 bronze가 없어서 silver에서 실패한다. 4장대로 그 폴더에서 bronze를 만들고 다시 돌린다.

   ```bash
   gh run rerun <run-id>
   ```

5. 통과 기준: 로그의 `90_checks` 줄이 모두 `true`이고, 실행이 성공(`completed success`)으로 끝난다.
6. 정리한다. 임시 트리거를 지우고 커밋하고, 러너를 Ctrl-C로 멈춘다. 러너 등록을 지우려면 다음 명령을 쓴다.

   ```bash
   ./config.sh remove --token "$(gh api -X POST repos/yanghoon/dataflow/actions/runners/remove-token --jq .token)"
   ```

### 8.3 B. act로 로컬에서

[act](https://nektosact.com)는 워크플로를 로컬에서 돌린다. `-self-hosted`로 라벨을 연결하면 Docker 없이 이 머신에서 바로 돈다. 저장소와 러너를 건드리지 않는다.

```bash
brew install act
act workflow_dispatch -W .github/workflows/lakehouse-jaffle_shop.yml \
  -P self-hosted=-self-hosted --input files='*.sql'
# 연결 정보가 필요하면 .env 모양 파일로 준다(Git에 올리지 않는다)
#   --var-file conn.vars --secret-file conn.secrets
```

통과 기준은 C와 같다. `secrets: inherit`, `vars`, `concurrency`, `clean: false`는 act가 GitHub과 다르게 다룰 수 있다. 다르게 동작하면 C의 결과를 믿는다.

### 8.4 D. `main` 머지 후

임시 트리거를 지운 상태로 머지하고 6.1처럼 `gh workflow run`으로 수동 실행한다. `-f files='2*.sql'`로 입력 전달도 한 번 확인한다.
