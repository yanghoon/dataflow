# 🚀 Ingestion 시스템 시작하기 (Getting Started)

## 1. 환영합니다! (Introduction)
**이 프로젝트는 무엇인가요?**  
이 프로젝트는 데이터를 수집(Ingestion)하고, 특정 시간에 작업을 예약하여 실행할 수 있도록 도와주는 백엔드 시스템입니다. 내부적으로 `db-scheduler`라는 안정적인 도구를 사용하여, 서버가 갑자기 꺼지더라도 여러분의 작업(Workflow)이 누락되지 않게 안전하게 관리해 줍니다.

---

## 2. 무작정 따라 하며 시작하기 (Getting Started)

**1단계: 내 PC에서 바로 실행하기 (Docker Compose)**  
복잡한 프로그램 설치 없이, 터미널(명령 프롬프트)에서 아래 명령어 한 줄만 입력하면 DB와 웹 서버가 한 번에 실행됩니다.
```bash
docker-compose up -d
```
> 💡 *팁: 테스트가 끝나고 모든 서버를 끄고 싶다면 `docker-compose down`을 입력하세요.*

**2단계: 쿠버네티스(k8s) 환경에 배포하기 (Skaffold)**  
로컬 테스트를 넘어 실제 운영 환경과 유사한 쿠버네티스(k8s)에 배포해보고 싶다면 Skaffold를 사용합니다.
```bash
skaffold run
```
명령어를 입력하면 소스 코드가 도커 이미지로 자동 빌드된 후, k8s 클러스터에 손쉽게 배포됩니다.

---

## 3. 데이터베이스는 어떻게 설정되어 있나요? (Database Setup)

**왜 DB가 필요한가요?**  
시스템이 여러분이 예약한 작업과 진행 상황을 잃어버리지 않고 기억하기 위해 데이터베이스(PostgreSQL 등)에 기록을 남깁니다.

**필수 DB 설정 및 스키마 생성 (v16.12.0 기준)**  
앱이 DB와 연결되려면 `application.yml` 파일에 커넥션 정보가 필요하며, `db-scheduler`는 테이블을 자동 생성하지 않으므로 초기 설정이 필요합니다.

1. **공식 스키마 다운로드**: 버전에 맞는 DDL 스크립트를 다운로드하여 `schema.sql`로 저장합니다.
   ```bash
   curl -sL -o src/main/resources/schema.sql https://raw.githubusercontent.com/kagkarlsson/db-scheduler/16.12.0/db-scheduler/src/test/resources/postgresql_tables.sql
   ```
2. **자동 생성 설정**: 애플리케이션 기동 시 실행되도록 하려면 `spring.sql.init.mode=always`를 설정하세요.

*(주의: 라이브러리 업그레이드 시 `UPGRADING.md`를 확인하고 수동 마이그레이션이 필요합니다.)*

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
