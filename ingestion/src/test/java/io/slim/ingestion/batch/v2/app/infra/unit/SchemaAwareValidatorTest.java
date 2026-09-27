package io.slim.ingestion.batch.v2.app.infra.unit;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.slim.ingestion.batch.v2.app.infra.batch.SchemaAwareValidator;
import io.slim.ingestion.batch.v2.app.infra.batch.SchemaAwareValidator.ConstraintViolationExceptionWrapper;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

class SchemaAwareValidatorTest {

    private SchemaAwareValidator<TestDto> validator;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        validator = new SchemaAwareValidator<>(TestDto.class, objectMapper);
    }

    @Test
    void testValidParameters() {
        var params = new JobParametersBuilder()
            .addString("name", "test-name")
            .toJobParameters();
        
        assertDoesNotThrow(() -> validator.validate(params));
    }

    @Test
    void testInvalidParameters() {
        var params = new JobParametersBuilder()
            .addString("name", "") // Blank
            .toJobParameters();
        
        var exception = assertThrows(ConstraintViolationExceptionWrapper.class, () -> validator.validate(params));
        assertEquals(1, exception.getViolations().size());
    }

    @Data
    public static class TestDto {
        @NotBlank
        private String name;
    }
}
