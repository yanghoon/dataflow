package io.slim.workflow.app.adapter.rest.batch;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import io.slim.workflow.app.adapter.rest.batch.SchemaAwareValidator.ConstraintViolationExceptionWrapper;

@RestControllerAdvice
public class ValidationExceptionHandler {

    @ExceptionHandler(ConstraintViolationExceptionWrapper.class)
    public ResponseEntity<List<Map<String, String>>> handleConstraintViolation(ConstraintViolationExceptionWrapper ex) {
        var violations = ex.getViolations();
        var errors = violations.stream().map(v -> {
            if (v instanceof jakarta.validation.ConstraintViolation<?> violation) {
                return Map.of(
                    "field", violation.getPropertyPath().toString(),
                    "message", violation.getMessage()
                );
            }
            return Map.of("field", "unknown", "message", "unknown error");
        }).collect(Collectors.toList());
        return ResponseEntity.badRequest().body(errors);
    }
}
