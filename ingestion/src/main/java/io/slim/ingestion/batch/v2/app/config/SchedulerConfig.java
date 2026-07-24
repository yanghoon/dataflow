package io.slim.ingestion.batch.v2.app.config;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.configuration.JobRegistry;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.context.EnvironmentAware;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import com.github.kagkarlsson.scheduler.task.Task;
import com.github.kagkarlsson.scheduler.task.helper.Tasks;
import com.github.kagkarlsson.scheduler.task.schedule.Schedules;

import io.slim.ingestion.batch.v2.app.config.SchedulerConfig.JobScheduleProps;
import io.slim.ingestion.batch.v2.app.config.SchedulerConfig.JobScheduleProps.ScheduleSpec;

@Configuration
public class SchedulerConfig {

    private static final Logger log = LoggerFactory.getLogger(SchedulerConfig.class);

    @org.springframework.context.annotation.Bean
    public Task<Void> dbSchedulerKeepAliveTask() {
        return Tasks.oneTime("db-scheduler-keepalive").execute((inst, ctx) -> {
            log.info("DbScheduler keepalive task executed");
        });
    }

    @Component
    public static class DynamicTaskRegistrar implements BeanFactoryPostProcessor, EnvironmentAware {
        
        private Environment environment;

        @Override
        public void setEnvironment(Environment environment) {
            this.environment = environment;
        }

        @Override
        public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
            JobScheduleProps props = Binder.get(environment)
                .bind("jobs", JobScheduleProps.class)
                .orElse(null);

            if (props == null || props.schedules() == null) {
                return;
            }

            for (ScheduleSpec spec : props.schedules()) {
                Task<Void> task = createBatchTask(spec, beanFactory);
                beanFactory.registerSingleton(spec.taskName(), task);
            }
        }

        private Task<Void> createBatchTask(ScheduleSpec spec, ConfigurableListableBeanFactory beanFactory) {
            String cronExp = spec.cron();
            if (cronExp == null || cronExp.trim().isEmpty()) {
                throw new IllegalArgumentException("Cron expr is required for " + spec.name());
            }

            return Tasks.recurring(spec.recurringName(), Schedules.cron(cronExp))
                    .execute((taskInstance, executionContext) -> {
                        Logger taskLog = LoggerFactory.getLogger(DynamicTaskRegistrar.class);
                        try {
                            taskLog.info("Starting scheduled batch job: {}", spec.name());
                            
                            JobLauncher jobLauncher = beanFactory.getBean(JobLauncher.class);
                            JobRegistry jobRegistry = beanFactory.getBean(JobRegistry.class);
                            var job = jobRegistry.getJob(spec.name());
                            
                            var params = new JobParametersBuilder()
                                .addString("startTime", LocalDateTime.now().toString())
                                .toJobParameters();
                            
                            jobLauncher.run(job, params);
                            taskLog.info("Successfully started scheduled batch job: {}", spec.name());
                        } catch (Exception e) {
                            taskLog.error("Failed to start scheduled batch job: {}", spec.name(), e);
                            throw new RuntimeException("Failed to start batch job", e);
                        }
                    });
        }
    }

    @ConfigurationProperties("jobs")
    public record JobScheduleProps(
        List<ScheduleSpec> schedules
    ) {
        public record ScheduleSpec(
            String name,
            String cron
        ) {
            String taskName() { return "task-" + name; }            
            String recurringName() { return "run-" + name; }            
        }
    }
}
