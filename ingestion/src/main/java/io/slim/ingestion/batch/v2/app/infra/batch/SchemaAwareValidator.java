package io.slim.ingestion.batch.v2.app.infra.batch;

import java.util.Set;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.InvalidJobParametersException;
import org.springframework.batch.core.job.parameters.JobParametersValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class SchemaAwareValidator<T> implements JobParametersValidator {

    @Getter
    private final Class<T> targetClass;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    public SchemaAwareValidator(Class<T> targetClass, ObjectMapper objectMapper) {
        this.targetClass = targetClass;
        this.objectMapper = objectMapper;
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        this.validator = factory.getValidator();
    }

    @Override
    public void validate(JobParameters parameters) throws InvalidJobParametersException {
        if (parameters == null) {
            return;
        }
        try {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            for (var param : parameters.parameters()) {
                map.put(param.name(), param.value());
            }
            T dto = objectMapper.convertValue(map, targetClass);
            Set<ConstraintViolation<T>> violations = validator.validate(dto);
            if (!violations.isEmpty()) {
                throw new ConstraintViolationExceptionWrapper(violations);
            }
        } catch (IllegalArgumentException e) {
            throw new InvalidJobParametersException("Failed to bind parameters: " + e.getMessage());
        }
    }

    public static class ConstraintViolationExceptionWrapper extends InvalidJobParametersException {
        @Getter
        private final Set<?> violations;

        public ConstraintViolationExceptionWrapper(Set<?> violations) {
            super("Validation failed");
            this.violations = violations;
        }
    }
}
