# Cartog MCP 인프라

`cartog` 기반의 코드베이스 분석 및 MCP 통신 환경입니다. 
Docker Compose 기반의 상시 구동 컨테이너(메인 서버, Java LSP 서버)와 이를 제어하는 래퍼 스크립트(`cartog.sh`)로 구성됩니다.

## ⚙️ 초기 설정 (순서대로 실행)

모든 명령어는 프로젝트 루트 디렉토리에서 실행합니다. 
스크립트 실행 시 도커 컨테이너가 켜져 있지 않으면 자동으로 구동(`docker compose up -d`)됩니다.

### 1. 설정 초기화
프로젝트 최상단에 기본 설정 파일(`.cartog.toml`)을 생성합니다.
```bash
sh tools/cartog/cartog.sh init
```

### 2. 임베딩 모델 다운로드
시맨틱 검색(RAG)용 로컬 모델을 호스트 캐시 경로(`~/.cache/cartog/models`)에 다운로드합니다.
호스트 터미널에 `HTTP_PROXY`, `HTTPS_PROXY`가 설정되어 있으면 컨테이너에 자동 주입되어 망분리/프록시 환경에서도 통신 가능합니다.
```bash
sh tools/cartog/cartog.sh rag setup
```

### 3. 코드 인덱싱
LSP 서버를 활용해 파일 간 의존성을 분석하고 검색용 DB를 구축합니다.
```bash
sh tools/cartog/cartog.sh index
```

### 4. 동작 확인 (선택)
인덱싱 결과를 통계와 검색 쿼리로 확인합니다.
```bash
sh tools/cartog/cartog.sh stats
sh tools/cartog/cartog.sh search "repository"
```

---

## 🔗 MCP 클라이언트 설정

Claude Desktop, Cursor 등의 MCP 설정 파일에 아래 구문을 추가합니다.
`args`의 첫 번째 값은 반드시 **호스트 운영체제 기준의 절대 경로**로 지정해야 합니다.

```json
{
  "mcpServers": {
    "cartog": {
      "command": "sh",
      "args": [
        "/절대/경로/입력/tools/cartog/cartog.sh",
        "serve",
        "--watch",
        "--rag"
      ]
    }
  }
}
```

---

## 🛠️ 인프라 수동 제어

도커 컨테이너를 수동으로 제어해야 할 경우 사용합니다.

```bash
# 구동 및 빌드
cd tools/cartog && docker compose up -d --build

# 인프라 종료
cd tools/cartog && docker compose down
```
