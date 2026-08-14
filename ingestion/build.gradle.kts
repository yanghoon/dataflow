plugins {
    id("java")
    id("org.springframework.boot") version "4.0.7"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.gorylenko.gradle-git-properties") version "4.0.1"
    id("com.google.cloud.tools.jib") version "3.5.4"
}

dependencies {
    // Batch
    implementation("org.springframework.boot:spring-boot-starter-batch")
    implementation("org.springframework.boot:spring-boot-starter-batch-jdbc")
    implementation("org.postgresql:postgresql")

    // Scheduler
    // implementation("org.jobrunr:jobrunr-spring-boot-3-starter:7.3.2")
    // implementation("org.jobrunr:jobrunr-spring-boot-4-starter:8.7.0")
    // implementation("com.github.kagkarlsson:db-scheduler-spring-boot-4-starter:16.12.0")
    implementation("no.bekk.db-scheduler-ui:db-scheduler-ui-spring-boot-4-starter:5.0.0")
    // implementation("io.rocketbase.extension:db-scheduler-log-spring-boot-starter:0.7.0")
    
    // Batch - S3
    implementation(platform("software.amazon.awssdk:bom:2.28.11"))
    implementation("software.amazon.awssdk:s3")
    implementation("software.amazon.awssdk:apache-client")

    // REST
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.2")

    // Mock Server
    implementation("org.springframework.cloud:spring-cloud-starter-contract-stub-runner")

    // Development
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    // developmentOnly("org.springframework.boot:spring-boot-devtools")
    // developmentOnly("org.springframework.boot:spring-boot-docker-compose")

    // Actuator
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.junit.platform:junit-platform-launcher")
    testImplementation("org.xerial:sqlite-jdbc")

    // Development for Test
    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")
}

extra["springCloudVersion"] = "2025.1.2"

dependencyManagement {
  imports {
    mavenBom("org.springframework.cloud:spring-cloud-dependencies:${property("springCloudVersion")}")
  }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

gitProperties {
    customProperty("git.build.time", "none")
    customProperty("git.build.host", "none")
    customProperty("git.build.user.name", "none")
    customProperty("git.build.user.email", "none")
    keys = listOf("git.branch", "git.commit.id.abbrev", "git.commit.time")
    dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
    dateFormatTimeZone = "UTC"
}

jib {
    // setAllowInsecureRegistries(true)
    from {
        image = "eclipse-temurin:21-jre-alpine"
    }
    container {
        creationTime = "USE_CURRENT_TIMESTAMP"
        jvmFlags = listOf(
            "-Djava.security.egd=file:/dev/./urandom",
            "-Dspring.profiles.active=local"
        )
    }
}
