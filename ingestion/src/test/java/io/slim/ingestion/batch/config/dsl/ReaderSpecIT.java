package io.slim.ingestion.batch.config.dsl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.batch.infrastructure.item.ItemReader;
import org.springframework.batch.infrastructure.item.database.support.SqlitePagingQueryProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@SpringBootTest(classes = {io.slim.ingestion.batch.TestApplication.class, ReaderSpecIT.TestConfig.class}, properties = {"spring.batch.job.enabled=false"})
public class ReaderSpecIT {

    @Autowired
    private DataSource dataSource;

    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS test_data (id INT PRIMARY KEY, name VARCHAR(255))");
        jdbcTemplate.execute("DELETE FROM test_data");
        jdbcTemplate.execute("INSERT INTO test_data (id, name) VALUES (1, 'Alice')");
        jdbcTemplate.execute("INSERT INTO test_data (id, name) VALUES (2, 'Bob')");
    }

    @Test
    void shouldReadDataWithCursorReader() throws Exception {
        CursorReaderSpec<String, Object> spec = new CursorReaderSpec<>(new Object(), r -> {});
        ItemReader<String> reader = spec
                .name("testCursorReader")
                .dataSource(dataSource)
                .sql("SELECT name FROM test_data ORDER BY id")
                .rowMapper((rs, rowNum) -> rs.getString("name"))
                .raw();

        if (reader instanceof org.springframework.batch.infrastructure.item.support.AbstractItemCountingItemStreamItemReader) {
            ((org.springframework.batch.infrastructure.item.support.AbstractItemCountingItemStreamItemReader) reader)
                    .open(new org.springframework.batch.infrastructure.item.ExecutionContext());
        }

        assertThat(reader.read()).isEqualTo("Alice");
        assertThat(reader.read()).isEqualTo("Bob");
        assertThat(reader.read()).isNull();
    }

    @Test
    void shouldReadDataWithPagingReader() throws Exception {
        SqlitePagingQueryProvider queryProvider = new SqlitePagingQueryProvider();
        queryProvider.setSelectClause("SELECT id, name");
        queryProvider.setFromClause("FROM test_data");
        Map<String, org.springframework.batch.infrastructure.item.database.Order> sortKeys = new HashMap<>();
        sortKeys.put("id", org.springframework.batch.infrastructure.item.database.Order.ASCENDING);
        queryProvider.setSortKeys(sortKeys);

        PagingReaderSpec<String, Object> spec = new PagingReaderSpec<>(new Object(), r -> {});
        ItemReader<String> reader = spec
                .name("testPagingReader")
                .dataSource(dataSource)
                .queryProvider(queryProvider)
                .pageSize(1)
                .rowMapper((rs, rowNum) -> rs.getString("name"))
                .raw();

        if (reader instanceof org.springframework.batch.infrastructure.item.support.AbstractItemCountingItemStreamItemReader) {
            ((org.springframework.batch.infrastructure.item.support.AbstractItemCountingItemStreamItemReader) reader)
                    .open(new org.springframework.batch.infrastructure.item.ExecutionContext());
        }

        assertThat(reader.read()).isEqualTo("Alice");
        assertThat(reader.read()).isEqualTo("Bob");
        assertThat(reader.read()).isNull();
    }
    
    @Configuration
    static class TestConfig {
        @Bean
        public io.slim.ingestion.batch.job.config.v2.ConnectionRegistry connectionRegistry() { 
            return org.mockito.Mockito.mock(io.slim.ingestion.batch.job.config.v2.ConnectionRegistry.class); 
        }
        
        @Bean
        public org.springframework.batch.core.configuration.JobRegistry jobRegistry() { 
            return new org.springframework.batch.core.configuration.support.MapJobRegistry(); 
        }
    }
}
