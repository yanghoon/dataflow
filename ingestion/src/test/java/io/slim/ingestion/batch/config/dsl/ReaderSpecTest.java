package io.slim.ingestion.batch.config.dsl;

import org.junit.jupiter.api.Test;
import org.springframework.batch.infrastructure.item.database.JdbcCursorItemReader;
import org.springframework.batch.infrastructure.item.database.JdbcPagingItemReader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

public class ReaderSpecTest {

    @Test
    void shouldConfigureCursorReader() {
        CursorReaderSpec<String, Object> spec = new CursorReaderSpec<>(new Object(), r -> {});
        JdbcCursorItemReader<String> reader = spec
                .name("testReader")
                .dataSource(mock(javax.sql.DataSource.class))
                .sql("SELECT 1")
                .rowMapper((rs, i) -> "test")
                .raw();

        assertThat(reader).isNotNull();
    }

    @Test
    void shouldConfigurePagingReaderAndTrackSaveState() {
        PagingReaderSpec<String, Object> spec = new PagingReaderSpec<>(new Object(), r -> {});
        spec.saveState(false);

        assertThat(spec.isSaveStateExplicitlySet()).isTrue();
        assertThat(spec.getSaveState()).isFalse();
    }
}
