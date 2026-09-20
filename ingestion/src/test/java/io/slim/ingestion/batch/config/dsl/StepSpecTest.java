package io.slim.ingestion.batch.config.dsl;

import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.infrastructure.item.ItemReader;
import org.springframework.transaction.PlatformTransactionManager;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class StepSpecTest {

    @Test
    void shouldThrowWhenModeIsMixed() {
        JobRepository jobRepository = mock(JobRepository.class);
        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        ItemReader<String> mockReader = mock(ItemReader.class);

        StepSpec<String, String> spec = new StepSpec<>("testStep", jobRepository, txManager);
        
        spec.cursorReader().name("dummy").dataSource(mock(javax.sql.DataSource.class)).sql("SELECT 1").rowMapper((rs, i) -> "dummy").and();
        
        spec.sync(s -> s.processor(item -> item).writer(chunk -> {}));

        assertThatThrownBy(() -> {
            spec.async(a -> {});
        }).isInstanceOf(IllegalStateException.class)
          .hasMessageContaining("Mode is already set to SYNC");
    }

    @Test
    void shouldBuildStepSuccessfully() {
        JobRepository jobRepository = mock(JobRepository.class);
        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);

        StepSpec<String, String> spec = new StepSpec<>("testStep", jobRepository, txManager);
        
        spec.cursorReader().name("dummy").dataSource(mock(javax.sql.DataSource.class)).sql("SELECT 1").rowMapper((rs, i) -> "dummy").and();

        spec.async((Consumer<AsyncProcessingSpec<String, String>>) a -> a.writer((org.springframework.batch.infrastructure.item.ItemWriter<String>) mock(org.springframework.batch.infrastructure.item.ItemWriter.class)));

        Step step = spec.build();
        assertThat(step).isNotNull();
        assertThat(step.getName()).isEqualTo("testStep");
    }
}
