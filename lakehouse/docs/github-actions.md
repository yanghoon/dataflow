# GitHub Actions로 Lakehouse 파이프라인 실행하기

이 가이드는 `pipeline/<system_type>/*.sql`(silver → gold → 검사)을 self-hosted 러너에서 실행하는 절차다. 결정과 이유는 [ADR lakehouse/0006](../../docs/adr/lakehouse/0006-github-actions-pipeline-per-system-type.md)에 있다.

> **NOTE:** 2026-11-27 기준으로 8.1(A), 8.2(B)를 실행해서 확인했다. 8.3(C), 8.4(D)는 실행하지 않았다.

## 0. 용어

이 가이드는 아래 이름만 쓴다.

| 이름 | 뜻 |
|---|---|
| 공통 워크플로 | `.github/workflows/_lakehouse-pipeline.yml`. 실행 로직을 가진다. 호출 파일만 공통 워크플로를 부른다 |
| 호출 파일 | `.github/workflows/lakehouse-<system_type>.yml`. System Type 하나의 트리거와 파이프라인 설정을 가진다. 지금은 `lakehouse-jaffle_shop.yml`만 있다 |
| 러너 | 이 저장소에 등록한 self-hosted 러너 |
| 러너 폴더 | 러너 프로그램을 푼 폴더. 이 가이드는 `~/actions-runner`를 쓴다 |
| 러너 작업 폴더 | 러너가 저장소를 checkout하는 폴더: `~/actions-runner/_work/dataflow/dataflow` |
| 연결 정보 | S3와 Postgres 접속 값(`S3_*`, `PG_*`). gh 시크릿과 gh 변수에 등록한다 |
| 파이프라인 설정 | `DATA_ROOT`, `INIT_FILES`. 호출 파일의 `env` 입력에 쓴다 |
| 실행 | GitHub Actions의 workflow run 하나 |

모든 `gh` 명령은 저장소 루트 폴더에서 실행한다. 저장소는 `yanghoon/dataflow`다.

## 1. 동작 방식

공통 워크플로는 환경 변수를 아래 순서로 읽는다. 같은 키는 나중에 읽은 값을 쓴다.

1. `pipeline/_init/*.sql`의 기본값. 값이 하나도 없으면 실행은 로컬 디스크(`lakehouse/s3-local`)를 쓴다.
2. 연결 정보(gh 시크릿, gh 변수). 3장에서 등록한다.
3. 파이프라인 설정(호출 파일의 `env` 입력). 5장에서 쓴다.

공통 워크플로는 bronze를 만들지 않는다. 공통 워크플로는 `pipeline/<system_type>/_sample/`을 실행하지 않는다.

## 2. 러너 준비

### 2.1 DuckDB CLI 설치

1. 러너 머신에 DuckDB CLI를 설치한다.

   ```bash
   brew install duckdb                      # macOS
   curl https://install.duckdb.org | sh     # macOS, Linux
   ```

2. `curl`로 설치했으면, `duckdb`를 `/usr/local/bin`에 연결한다.

   ```bash
   sudo ln -sf ~/.duckdb/cli/latest/duckdb /usr/local/bin/duckdb
   ```

3. 버전을 확인한다.

   ```bash
   duckdb --version
   ```

   결과: 버전 문자열(예: `v2.0.0`)이 나온다.

> **CAUTION:** 러너 서비스는 로그인 셸의 `PATH`를 읽지 않는다. 러너를 서비스로 실행하면, `duckdb`가 있는 폴더를 러너 폴더의 `.path` 파일에 더하고 서비스를 다시 시작한다.

> **CAUTION:** DuckDB는 실행 중에 `httpfs`, `postgres` 확장을 내려받는다. 러너 머신이 인터넷에 접속하지 못하면, 두 확장을 미리 설치한다.

### 2.2 러너 등록

1. 러너 머신의 OS와 CPU를 변수에 설정한다.

   ```bash
   OS=osx      # Linux: linux
   ARCH=x64    # Apple Silicon, ARM: arm64. 확인: uname -m
   ```

2. 러너 최신 버전을 변수에 설정한다.

   ```bash
   V=$(gh release view --repo actions/runner --json tagName --jq '.tagName | ltrimstr("v")')
   ```

3. 러너 폴더를 만들고 러너 프로그램을 푼다.

   ```bash
   mkdir -p ~/actions-runner && cd ~/actions-runner
   curl -fL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${V}/actions-runner-${OS}-${ARCH}-${V}.tar.gz"
   tar xzf runner.tar.gz
   ```

4. 등록 토큰을 받아 러너를 등록한다.

   ```bash
   TOKEN=$(gh api -X POST repos/yanghoon/dataflow/actions/runners/registration-token --jq .token)
   ./config.sh --url https://github.com/yanghoon/dataflow --token "$TOKEN" --name "$(hostname -s)-lakehouse" --unattended
   ```

> **NOTE:** 등록 토큰은 1시간 동안 유효하다.

5. 러너를 시작한다. 시험할 때는 앞에서 실행한다(5-a). 운영할 때는 서비스로 실행한다(5-b).

   ```bash
   ./run.sh                                       # 5-a. 멈추려면 Ctrl-C
   sudo ./svc.sh install && sudo ./svc.sh start   # 5-b. Linux
   ./svc.sh install && ./svc.sh start             # 5-b. macOS
   ```

6. 러너 상태를 확인한다.

   ```bash
   gh api repos/yanghoon/dataflow/actions/runners --jq '.runners[] | {id, name, status, labels: [.labels[].name]}'
   ```

   결과: `status`가 `online`이다.

### 2.3 라벨(선택)

공통 워크플로는 `runs-on: [self-hosted]`를 쓴다. 그래서 실행은 이 저장소의 모든 러너에서 시작할 수 있다. 실행을 특정 러너에서만 시작하려면, 아래 절차로 라벨을 붙인다.

1. 러너에 라벨을 붙인다. 등록할 때 붙이거나(1-a), 등록한 뒤에 붙인다(1-b).

   ```bash
   ./config.sh … --labels <label>                                                                    # 1-a
   gh api -X POST repos/yanghoon/dataflow/actions/runners/<id>/labels -f 'labels[]=<label>'          # 1-b
   ```

2. 공통 워크플로의 `runs-on: [self-hosted]` 줄을 주석의 `runs-on: [self-hosted, <label>]`로 바꾼다.

## 3. 연결 정보 등록

모든 호출 파일은 같은 연결 정보를 쓴다. 쓰는 연결의 값만 등록한다.

> **WARNING:** 시크릿 원본 값을 저장소 밖(예: 비밀번호 관리 도구)에 보관한다. GitHub는 등록한 시크릿 값을 다시 보여 주지 않는다.

### 3.1 시크릿

1. 비밀 값을 시크릿으로 등록한다. `gh`가 값을 물어보면 값을 입력한다.

   ```bash
   gh secret set S3_ACCESS_KEY_ID
   gh secret set S3_SECRET_KEY_ID
   gh secret set PG_PASSWORD
   ```

2. 등록을 확인한다.

   ```bash
   gh secret list
   ```

   결과: 이름과 수정 시각이 나온다. 값은 나오지 않는다.

> **CAUTION:** `--body`로 비밀 값을 주면 셸 이력에 비밀 값이 남는다. 비밀 값은 `gh`가 물어볼 때 입력한다.

시크릿 값을 바꾸려면, 3.1의 1단계 명령을 다시 실행한다.

### 3.2 변수

1. 비밀이 아닌 값을 변수로 등록한다. 값을 등록하지 않은 키는 `pipeline/.env.example`의 기본값을 쓴다.

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

2. 등록을 확인한다.

   ```bash
   gh variable list
   ```

   결과: 이름과 값이 나온다.

### 3.3 로컬에서 같은 연결 정보 사용

1. `pipeline/.env`를 만든다.

   ```bash
   cd lakehouse && cp pipeline/.env.example pipeline/.env
   ```

2. `gh variable list`의 값을 `pipeline/.env`에 쓴다.
3. 시크릿 원본 값을 `pipeline/.env`에 쓴다.

## 4. bronze 준비

실행은 `DATA_ROOT`에 bronze가 있어야 성공한다. 실제 수집(Kestra, Airbyte)이 아직 없는 System Type은 `_sample`로 bronze를 만든다.

> **CAUTION:** `DATA_ROOT`에 bronze가 없으면 실행이 silver 단계에서 실패한다. 실행 전에 4.1 또는 4.2를 끝낸다.

### 4.1 S3를 쓸 때

1. 로컬 `pipeline/.env`에 실행과 같은 `DATA_ROOT`와 연결 정보를 쓴다(3.3).
2. bronze를 만든다.

   ```bash
   cd lakehouse
   mkdir -p source/jaffle_shop
   pipeline/run.sh pipeline/jaffle_shop/_sample/0*.sql
   ```

### 4.2 로컬 디스크를 쓸 때(기본값)

실행은 러너 작업 폴더의 `lakehouse/s3-local`에 쓴다. 공통 워크플로는 `clean: false`로 checkout한다. 그래서 `lakehouse/s3-local`은 실행 사이에 남는다.

> **CAUTION:** `run.sh`는 `pipeline/.env`를 읽고, `pipeline/.env`의 값이 환경 변수를 덮는다. 러너 작업 폴더에서는 `pipeline/.env` 없이 명령을 실행한다. 공통 워크플로는 러너 작업 폴더에 `pipeline/.env`가 있으면 실행을 실패로 끝낸다.

1. 실행을 한 번 시작한다(6.1). 러너가 러너 작업 폴더를 만든다.
2. 러너 작업 폴더에서 bronze를 만든다.

   ```bash
   cd ~/actions-runner/_work/dataflow/dataflow/lakehouse
   mkdir -p source/jaffle_shop
   pipeline/run.sh pipeline/jaffle_shop/_sample/0*.sql
   ```

## 5. 파이프라인 설정

호출 파일의 `env` 입력에 파이프라인 설정을 쓴다. 연결 정보와 같은 키를 쓰면, `env` 입력의 값이 연결 정보를 덮는다.

```yaml
# .github/workflows/lakehouse-jaffle_shop.yml
    with:
      system_type: jaffle_shop
      env: |
        DATA_ROOT=s3://local
        INIT_FILES=pipeline/_init/pg.sql pipeline/_init/base.sql pipeline/_init/s3.sql
```

`env` 입력은 아래 규칙을 따른다.

- 한 줄에 `KEY=VALUE` 하나를 쓴다.
- 빈 줄과 `#`으로 시작하는 줄은 공통 워크플로가 건너뛴다.
- 모든 줄이 주석이면, 실행은 로컬 디스크를 쓴다.
- `INIT_FILES`의 파일은 쓴 순서대로 읽힌다. `pg.sql`을 `base.sql` 앞에 쓴다.

> **CAUTION:** 공통 워크플로는 따옴표를 값의 일부로 읽는다. `env` 입력의 값은 따옴표 없이 쓴다.

> **CAUTION:** 호출 파일의 `env:` 키는 공통 워크플로에 전달되지 않는다(GitHub 제약). 파이프라인 설정은 `with.env` 입력에 쓴다.

## 6. 실행

### 6.1 수동 실행

> **NOTE:** 수동 실행(`workflow_dispatch`)은 호출 파일이 `main`에 있을 때만 시작된다. 호출 파일이 기능 브랜치에만 있으면 8.2의 방법을 쓴다.

1. 실행을 시작한다. 모든 SQL은 1-a, silver만은 1-b를 쓴다.

   ```bash
   gh workflow run lakehouse-jaffle_shop.yml                      # 1-a
   gh workflow run lakehouse-jaffle_shop.yml -f files='2*.sql'    # 1-b
   ```

2. 실행 ID를 찾는다.

   ```bash
   gh run list --workflow lakehouse-jaffle_shop.yml --limit 5
   ```

3. 실행이 끝날 때까지 본다.

   ```bash
   gh run watch <run-id>
   ```

4. 로그를 확인한다.

   ```bash
   gh run view <run-id> --log
   ```

   결과: `90_checks` 줄의 `ok` 열이 모두 `true`다.

웹 화면에서는 Actions → `lakehouse-jaffle_shop` → Run workflow로 실행을 시작한다.

### 6.2 스케줄

1. 호출 파일에서 `schedule:` 두 줄의 주석을 푼다.

   ```yaml
     schedule:
       - cron: "0 18 * * *"   # UTC. 매일 KST 03:00
   ```

2. `cron` 값을 UTC로 쓴다. KST에서 9시간을 뺀다.
3. 호출 파일을 `main`에 머지한다.

> **NOTE:** GitHub는 스케줄 실행을 몇 분 늦게 시작할 수 있다. 스케줄 실행은 `main`의 호출 파일만 쓴다.

스케줄을 멈추려면, `schedule:` 두 줄을 다시 주석으로 바꾸거나 아래 명령을 실행한다.

```bash
gh workflow disable lakehouse-jaffle_shop.yml   # 다시 켜기: gh workflow enable lakehouse-jaffle_shop.yml
```

### 6.3 실행이 겹칠 때

같은 System Type의 실행은 한 번에 하나만 진행된다. 새 실행은 앞 실행이 끝날 때까지 기다린다.

> **CAUTION:** 대기 자리는 하나다. 실행 중에 새 실행이 두 번 들어오면, GitHub는 먼저 기다리던 실행을 취소한다. 취소된 실행이 필요하면 앞 실행이 끝난 뒤 다시 시작한다.

## 7. System Type 추가

1. `lakehouse-jaffle_shop.yml`을 `lakehouse-<system_type>.yml`로 복사한다.
2. 새 호출 파일에서 `name`, `system_type`, `env`, `files` 설명을 바꾼다.
3. 새 호출 파일의 스케줄을 정한다(6.2).
4. 새 연결이 필요하면, 3장의 절차로 시크릿과 변수를 더한다.
5. 새 연결의 키가 공통 워크플로의 `jobs.run.env` 목록에 없으면, `jobs.run.env`에 키를 더한다.

> **NOTE:** 새 연결의 키 이름이 기존 연결 정보와 같으면, 새 호출 파일의 `env` 입력으로 값을 덮을 수 있다.

## 8. 워크플로 시험

워크플로를 바꾸면 A → B 순서로 시험한다.

> **WARNING:** B는 담당자의 동의를 받은 뒤 시작한다. B는 저장소에 커밋을 push하고 러너를 켠다.

C와 D는 B로 확인할 수 없는 항목이 있고 그 항목의 시험이 꼭 필요할 때만 쓴다. 담당자에게 확인할 항목과 이유를 알리고, 승인을 받은 뒤 시작한다.

> **WARNING:** 러너는 시험하는 동안에만 켠다. 이 저장소는 public이라서, 러너가 켜져 있으면 `self-hosted` 라벨을 쓰는 모든 워크플로가 러너 머신에서 실행될 수 있다.

> **WARNING:** `pull_request` 트리거 워크플로에는 `runs-on: ubuntu-latest` 같은 GitHub 호스티드 러너를 쓴다. 포크 PR의 코드가 러너 머신에서 실행될 수 있다.

> **NOTE:** 포크 PR 워크플로의 승인 범위는 Settings → Actions → General → Fork pull request workflows에서 정한다. 2026-11-27 값은 `first_time_contributors`다.

| | 방법 | 쓰는 경우 | 확인하는 것 | 확인하지 않는 것 |
|---|---|---|---|---|
| A | 실행 스크립트를 로컬에서 실행 | 기본 | `env` 입력 덮어쓰기, 입력 검사, SQL 실행 | 호출 파일과 공통 워크플로의 연결, 연결 정보, 러너 |
| B | 기능 브랜치의 임시 `push` 트리거 | 기본(동의 후) | GitHub의 실제 동작: 러너, 연결 정보, `PATH`, 러너 작업 폴더 | 수동 실행, `files` 입력 |
| C | act로 로컬에서 실행 | 선택: B를 쓸 수 없을 때 | 호출 파일과 공통 워크플로의 연결, 입력 전달 | act가 GitHub과 다르게 다룰 수 있는 것(8.3) |
| D | `main` 머지 후 수동 실행 | 선택: 수동 실행과 `files` 입력을 시험할 때 | 실제 운영 방식 전부 | 없음 |

### 8.1 A. 실행 스크립트를 로컬에서 실행

A는 공통 워크플로의 `Run pipeline` 스크립트를 꺼내 `lakehouse/`에서 실행한다. A는 로컬 `s3-local`에 bronze가 있어야 한다(README 2~3장).

> **CAUTION:** 2단계는 로컬 `s3-local`의 silver와 gold를 다시 쓴다. 로컬 silver와 gold를 보존하려면 2단계 전에 복사한다.

1. 스크립트를 꺼낸다.

   ```bash
   cd lakehouse
   ruby -ryaml -e 'puts YAML.load_file("../.github/workflows/_lakehouse-pipeline.yml")["jobs"]["run"]["steps"][1]["run"]' > /tmp/step.sh
   ```

2. `env` 입력이 비어 있을 때의 실행을 확인한다.

   ```bash
   SYSTEM_TYPE=jaffle_shop FILES='*.sql' PIPELINE_ENV='' bash /tmp/step.sh
   ```

   결과: `DATA_ROOT=s3-local`이 나오고, `90_checks`의 `ok` 열이 모두 `true`다.

3. `env` 입력이 바깥 값을 덮는지 확인한다. 바깥 `DATA_ROOT`는 gh 변수를 대신한다.

   ```bash
   DATA_ROOT=from-gh SYSTEM_TYPE=jaffle_shop FILES='9*.sql' PIPELINE_ENV='DATA_ROOT=s3-local' bash /tmp/step.sh
   ```

   결과: `DATA_ROOT=s3-local`이 나온다.

4. 잘못된 입력에서 실행이 실패하는지 확인한다.

   ```bash
   SYSTEM_TYPE='../x' FILES='' PIPELINE_ENV='' bash /tmp/step.sh                       # 잘못된 system_type
   SYSTEM_TYPE=jaffle_shop FILES='9*.sql' PIPELINE_ENV='not a pair' bash /tmp/step.sh   # KEY=VALUE 가 아닌 줄
   SYSTEM_TYPE=jaffle_shop FILES='7*.sql' PIPELINE_ENV='' bash /tmp/step.sh             # 고른 SQL 파일 없음
   ```

   결과: 세 명령 모두 `::error::` 줄을 쓰고 종료 코드 `2`로 끝난다.

### 8.2 B. 기능 브랜치의 임시 `push` 트리거

`push` 실행은 push한 커밋의 호출 파일을 쓴다. 그래서 B는 `main`에 머지하지 않고 GitHub에서 실행을 시작한다.

1. 러너를 등록한다(2.2의 1~4단계).
2. 러너를 앞에서 시작한다. 이 터미널은 시험이 끝날 때까지 열어 둔다.

   ```bash
   cd ~/actions-runner && ./run.sh
   ```

3. 호출 파일의 `on:`에 임시 트리거를 더한다.

   ```yaml
     push:                       # 임시: 기능 브랜치 시험용(가이드 8.2). main 에 머지하기 전에 지운다
       branches: [<기능 브랜치>]
       paths: [".github/workflows/*lakehouse*", "lakehouse/pipeline/**"]
   ```

4. 호출 파일을 커밋하고 기능 브랜치에 push한다.

   ```bash
   git push origin <기능 브랜치>
   ```

5. 실행 ID를 찾는다.

   ```bash
   gh run list --workflow lakehouse-jaffle_shop.yml --branch <기능 브랜치> --limit 3
   ```

   결과: `push` 실행이 하나 나온다. 첫 실행은 silver 단계에서 실패한다(bronze 없음).

6. 러너 작업 폴더에서 bronze를 만든다(4.2의 2단계).
7. 실행을 다시 시작한다.

   ```bash
   gh run rerun <run-id>
   ```

8. 실행 결과를 확인한다.

   ```bash
   gh run watch <run-id>
   gh run view <run-id> --log
   ```

   결과: 실행이 `success`로 끝나고, `90_checks`의 `ok` 열이 모두 `true`다.

9. 호출 파일에서 임시 트리거를 지우고 커밋한다.
10. 러너 터미널에서 Ctrl-C로 러너를 멈춘다.
11. 러너를 다시 쓰지 않으면, 러너 등록을 지운다.

    ```bash
    cd ~/actions-runner
    ./config.sh remove --token "$(gh api -X POST repos/yanghoon/dataflow/actions/runners/remove-token --jq .token)"
    ```

> **CAUTION:** 임시 트리거가 남아 있으면 기능 브랜치에 push할 때마다 실행이 시작된다. `main`에 머지하기 전에 9단계를 끝낸다.

### 8.3 C. act로 로컬에서 실행

C는 B를 쓸 수 없을 때(예: 러너를 켤 수 없음) 쓴다. [act](https://nektosact.com)는 워크플로를 로컬에서 실행한다. `-P self-hosted=-self-hosted`를 주면 act는 Docker 없이 로컬 머신에서 실행한다. C는 저장소와 러너를 바꾸지 않는다.

1. act를 설치한다.

   ```bash
   brew install act
   ```

2. 연결 정보가 필요하면, `.env` 모양의 파일 두 개를 저장소 밖에 만든다: 변수 파일, 시크릿 파일.
3. 호출 파일을 실행한다. 연결 정보 파일이 없으면 `--var-file`, `--secret-file`을 뺀다.

   ```bash
   act workflow_dispatch -W .github/workflows/lakehouse-jaffle_shop.yml \
     -P self-hosted=-self-hosted --input files='*.sql' \
     --var-file <변수 파일> --secret-file <시크릿 파일>
   ```

   결과: 8.2의 8단계와 같다.

> **NOTE:** act 문서는 `secrets: inherit`, `vars` 전달, `concurrency`, `clean: false`의 동작을 설명하지 않는다. act의 결과가 B의 결과와 다르면 B의 결과가 기준이다.

### 8.4 D. `main` 머지 후 수동 실행

D는 수동 실행과 `files` 입력을 시험할 때 쓴다.

1. 호출 파일에 임시 트리거가 없는지 확인한다(8.2의 9단계).
2. 기능 브랜치를 `main`에 머지한다.
3. 실행을 시작한다(6.1의 1-a).

   결과: 6.1의 4단계와 같다.

4. `files` 입력으로 실행을 한 번 더 시작한다(6.1의 1-b).

   결과: 로그에 `20_silver_order_lines.sql`만 나온다.
