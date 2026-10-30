package io.slim.workflow.app.job.customer;

import java.nio.charset.StandardCharsets;
import java.util.Collections;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

import io.slim.workflow.app.job.SpringBatchSliceTest;

@SpringBatchSliceTest
public class CustomerDormantJobTests {

    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seedCsv() throws Exception {
        var insertSql = "insert into customers (%s) values (%s)".formatted(
            String.join(",", new String[] {""}),
            String.join(",", Collections.nCopies(10, "?")
        ));
        var csv = new ClassPathResource("data/customers.csv").getContentAsString(StandardCharsets.UTF_8);
        var rows = csv.lines().skip(1).map(line -> (Object[]) line.split(",")).toList();
        jdbcTemplate.batchUpdate(insertSql, rows);

    }
    
    @Test
    void test() {
        // TODO: Run Test Job
    }

}
