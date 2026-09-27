package io.slim.ingestion.batch.v2.app.infra.config;

import com.github.victools.jsonschema.generator.OptionPreset;
import com.github.victools.jsonschema.generator.SchemaGenerator;
import com.github.victools.jsonschema.generator.SchemaGeneratorConfigBuilder;
import com.github.victools.jsonschema.generator.SchemaVersion;
import com.github.victools.jsonschema.module.jakarta.validation.JakartaValidationModule;
import com.github.victools.jsonschema.module.jakarta.validation.JakartaValidationOption;
import org.springframework.stereotype.Service;

@Service
public class ConfigSchemaGenerator {
    public String generateSchema(Class<?> clazz) {
        SchemaGeneratorConfigBuilder configBuilder = new SchemaGeneratorConfigBuilder(
            SchemaVersion.DRAFT_2020_12, OptionPreset.PLAIN_JSON);
        configBuilder.with(new JakartaValidationModule(JakartaValidationOption.NOT_NULLABLE_FIELD_IS_REQUIRED));
        SchemaGenerator generator = new SchemaGenerator(configBuilder.build());
        return generator.generateSchema(clazz).toString();
    }
}
