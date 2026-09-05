package io.slim.workflow.app.adapter.rest;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.PropertiesPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.slim.workflow.app.adapter.scheduler.WorkflowScheduleBootstrapper;
import io.slim.workflow.app.config.workflow.WorkflowProperties;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/workflows")
@RequiredArgsConstructor
public class WorkflowAdminController {

    private final WorkflowScheduleBootstrapper bootstrapper;

    @PostMapping("/reload")
    public Map<String, Object> reloadYaml(@RequestParam(defaultValue = "classpath:application-workflow.yaml") String configPath) {
        Resource resource = configPath.startsWith("classpath:")
                ? new ClassPathResource(configPath.substring("classpath:".length()))
                : new FileSystemResource(configPath);

        if (!resource.exists()) {
            return Map.of(
                "status", "error",
                "message", "Configuration file not found: " + configPath
            );
        }

        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(resource);
        Properties properties = factory.getObject();

        StandardEnvironment env = new StandardEnvironment();
        if (properties != null) {
            env.getPropertySources().addFirst(new PropertiesPropertySource("dynamicYaml", properties));
        }

        WorkflowProperties newYamlJobs = Binder.get(env)
                .bind("workflow", WorkflowProperties.class)
                .orElse(new WorkflowProperties(new HashMap<>()));

        bootstrapper.syncAll(newYamlJobs);

        return Map.of(
            "status", "success",
            "message", "Successfully reloaded " + (newYamlJobs.jobs() != null ? newYamlJobs.jobs().size() : 0) + " jobs from " + configPath
        );
    }
}
