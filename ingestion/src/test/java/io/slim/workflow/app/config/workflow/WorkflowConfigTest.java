package io.slim.workflow.app.config.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;

// import io.slim.workflow.app.config.workflow.WorkflowJobProperties;
import io.slim.workflow.domain.Workflow;
import io.slim.workflow.domain.repo.WorkflowJobRepository;
import io.slim.workflow.domain.repo.WorkflowRepository;

class WorkflowConfigTest {

    // @Test
    // void testWorkflowRepository() {
    //     DefaultListableBeanFactory beanFactory = new DefaultListableBeanFactory();
    //     Workflow mockWorkflow = mock(Workflow.class);
    //     beanFactory.registerSingleton("myWorkflow", mockWorkflow);

    //     WorkflowConfig config = new WorkflowConfig(beanFactory);
    //     WorkflowRepository repository = config.workflowRepository();

    //     Optional<Workflow> result = repository.findByWorkflowType("myWorkflow");
    //     assertThat(result).isPresent();
    //     assertThat(result.get()).isEqualTo(mockWorkflow);
    // }

    // @Test
    // void testWorkflowJobRepository() {
    //     WorkflowConfig config = new WorkflowConfig(new DefaultListableBeanFactory());
    //     WorkflowJobRepository repository = config.workflowJobRepository();

    //     WorkflowJobProperties props = new WorkflowJobProperties("job1", "group1", null, "0 0 * * * *", true, "type1", null, null, "desc1");
    //     repository.save(props);

    //     Optional<WorkflowJobProperties> result = repository.findByJobName("job1");
    //     assertThat(result).isPresent();
    //     assertThat(result.get().workflowType()).isEqualTo("type1");
    // }
}
