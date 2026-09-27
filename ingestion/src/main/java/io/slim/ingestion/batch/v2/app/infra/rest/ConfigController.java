package io.slim.ingestion.batch.v2.app.infra.rest;

import io.slim.ingestion.batch.v2.app.infra.repository.SettingsService;
import io.slim.ingestion.batch.v2.app.infra.config.ConfigSchemaGenerator;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/config")
public class ConfigController {
    private final SettingsService service;
    private final ConfigSchemaGenerator generator;

    public ConfigController(SettingsService service, ConfigSchemaGenerator generator) {
        this.service = service;
        this.generator = generator;
    }

    @PutMapping("/settings/{key}")
    public void updateSetting(@PathVariable String key, @RequestBody String value) {
        service.saveSetting(key, value);
    }
    
    @GetMapping("/schema")
    public String getSchema() {
        return generator.generateSchema(DummyDto.class);
    }

    public static class DummyDto {
        @jakarta.validation.constraints.NotNull
        public String name;
    }
}
