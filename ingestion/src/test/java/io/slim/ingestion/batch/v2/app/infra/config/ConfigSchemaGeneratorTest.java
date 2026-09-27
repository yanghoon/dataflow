package io.slim.ingestion.batch.v2.app.infra.config;

import org.junit.jupiter.api.Test;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConfigSchemaGeneratorTest {

    static class DummyConfig {
        @NotNull
        public String name;
        
        @Min(1)
        public int age;
    }

    @Test
    void testGenerateSchema() {
        ConfigSchemaGenerator generator = new ConfigSchemaGenerator();
        String schema = generator.generateSchema(DummyConfig.class);
        System.out.println("SCHEMA: " + schema);
        
        assertTrue(schema.contains("\"required\":[\"name\"]") || schema.contains("\"required\": [\"name\"]"));
        assertTrue(schema.contains("\"minimum\":1") || schema.contains("\"minimum\": 1"));
    }
}
