# 🚀 Ingestion 시스템 시작하기 (Getting Started)

## 1. 환영합니다! (Introduction)
**이 프로젝트는 무엇인가요?**  
이 프로젝트는 데이터를 수집(Ingestion)하고, 특정 시간에 작업을 예약하여 실행할 수 있도록 도와주는 백엔드 시스템입니다. 내부적으로 `db-scheduler`라는 안정적인 도구를 사용하여, 서버가 갑자기 꺼지더라도 여러분의 작업(Workflow)이 누락되지 않게 안전하게 관리해 줍니다.

---

## 2. 무작정 따라 하며 시작하기 (Getting Started)

**1단계: 인프라 구동 (Docker Compose)**  
터미널에서 아래 명령어를 입력하여 로컬 개발용 DB와 스토리지를 구동합니다.
```bash
docker-compose up -d
```
> 💡 *팁: 모든 환경을 초기화하며 종료하려면 `docker-compose down -v`를 사용하세요.*

**2단계: 애플리케이션 실행**  
로컬 환경에서 Ingestion 앱을 실행합니다.
```bash
./gradlew :ingestion:bootRun
```

**3단계: 쿠버네티스(k8s) 배포 (Skaffold)**  
운영 환경과 유사한 k8s 배포를 위해 다음 절차를 수행합니다.

1. **DB 스키마 초기화**: 운영 DB 환경 구성을 위해 `src/main/resources/sql/schema/`의 스크립트들을 타겟 DB에 수동으로 실행합니다.
```bash
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f src/main/resources/sql/schema/db_scheduler.sql
```
2. **시크릿 환경변수 구성**: k8s Secret 주입을 위해 `k8s/base/.env.example`을 복사하여 대상 사이트(예: `site-a`)에 맞는 템플릿 파일을 생성합니다. 생성된 파일에 운영 환경에 맞는 실제 값을 기입해 주세요.
```bash
cp k8s/base/.env.example k8s/overlays/prod-site-a/.env.prod-site-a
```
3. **앱 배포**: Kustomize 기반의 k8s 배포를 위해 타겟 프로파일(예: `prod-site-a`)을 지정하여 아래 명령어를 실행합니다.
```bash
skaffold run -p prod-site-a
```

---

## 3. 데이터베이스는 어떻게 설정되어 있나요? (Database Setup)

로컬 실행 시 개발자의 별도 DB 설정 개입은 필요하지 않습니다. 
`compose.yaml`을 통해 Postgres 컨테이너가 처음 생성될 때, `src/main/resources/sql/schema/` 폴더 하위의 모든 SQL 스크립트들이 알파벳 순서대로 마운트되어 자동 실행되며 DB 초기화가 완료됩니다.

---

## 4. 웹 화면(UI)으로 내 작업 관리하기 (Dashboard UI)

터미널 창의 복잡한 로그를 보지 않아도, 웹 브라우저에서 예약된 작업 상태를 예쁘고 편리하게 확인할 수 있습니다.

- **대시보드 접속하기**: 앱을 실행한 상태에서 브라우저를 열고 `http://localhost:8080/db-scheduler` (또는 설정된 포트)로 접속하세요.
- **작업 상태 확인**: 현재 실행 중인 작업(Executing), 앞으로 실행될 작업(Scheduled) 목록이 직관적으로 표시됩니다.
- **실패한 작업 다시 실행하기 (Retry)**: 에러가 발생해 멈춘 작업이 있다면, UI 목록에서 해당 작업을 클릭하고 **'Retry'** 버튼을 누르면 즉시 다시 실행됩니다.

---

## 5. 나만의 워크플로우 만들기 (Create Your First Workflow)

**어떤 작업(타입)을 만들 수 있나요?**  
현재 시스템은 2가지 주요 워크플로우를 지원합니다.
1. `OneTimeTask`: 지금 당장 혹은 지정된 시간에 **한 번만** 실행하고 끝나는 작업
2. `RecurringTask`: 매일 자정, 매시간 정각 등 **반복적**으로 실행되는 작업

**[실습] 새로운 WorkflowJob 추가하기**  
가장 단순한 단발성 작업을 만들어 보겠습니다. 아래 코드를 복사해서 프로젝트에 추가해 보세요!

```java
import com.github.kagkarlsson.scheduler.task.helper.Tasks;
import com.github.kagkarlsson.scheduler.task.Task;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MyFirstWorkflow {
    
    @Bean
    public Task<Void> mySimpleTask() {
        return Tasks.oneTime("my-simple-task")
            .execute((taskInstance, executionContext) -> {
                System.out.println("🎉 나의 첫 번째 워크플로우가 무사히 실행되었습니다!");
            });
    }
}
```
저장 후 서버를 재시작하고 UI에 접속해 보세요. 방금 만든 `my-simple-task`가 목록에 나타납니다!
