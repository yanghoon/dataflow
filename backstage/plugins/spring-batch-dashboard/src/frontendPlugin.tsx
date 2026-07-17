import {
  createFrontendPlugin,
  ApiBlueprint,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { createApiFactory, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { springBatchApiRef, SpringBatchClient } from './api';
import { rootRouteRef } from './routes';
import DashboardIcon from '@mui/icons-material/Dashboard';

export const springBatchApiExtension = ApiBlueprint.make({
  params: factory => factory(
    createApiFactory({
      api: springBatchApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new SpringBatchClient({ discoveryApi, fetchApi }),
    })
  ),
});

export const springBatchPageExtension = PageBlueprint.make({
  name: 'spring-batch-dashboard',
  params: {
    path: '/spring-batch',
    title: 'Spring Batch',
    icon: <DashboardIcon />,
    routeRef: rootRouteRef,
    loader: async () => {
      const { SpringBatchPage } = await import('./components/SpringBatchPage');
      return <SpringBatchPage />;
    },
  },
});

export const springBatchJobInstancesPageExtension = PageBlueprint.make({
  name: 'spring-batch-instances',
  params: {
    path: '/spring-batch/instances',
    loader: async () => {
      const { JobInstancesPage } = await import('./components/JobInstancesPage');
      return <JobInstancesPage />;
    },
  },
});

export const springBatchJobExecutionsPageExtension = PageBlueprint.make({
  name: 'spring-batch-executions',
  params: {
    path: '/spring-batch/executions',
    loader: async () => {
      const { JobExecutionsPage } = await import('./components/JobExecutionsPage');
      return <JobExecutionsPage />;
    },
  },
});

export const springBatchFailuresPageExtension = PageBlueprint.make({
  name: 'spring-batch-failures',
  params: {
    path: '/spring-batch/failures',
    loader: async () => {
      const { FailuresPage } = await import('./components/FailuresPage');
      return <FailuresPage />;
    },
  },
});

export const springBatchRetryHistoryPageExtension = PageBlueprint.make({
  name: 'spring-batch-retry-history',
  params: {
    path: '/spring-batch/instances/:instanceId/history',
    loader: async () => {
      const { RetryHistoryPage } = await import('./components/RetryHistoryPage');
      return <RetryHistoryPage />;
    },
  },
});

export const springBatchExecutionDetailPageExtension = PageBlueprint.make({
  name: 'spring-batch-execution-detail',
  params: {
    path: '/spring-batch/executions/:id',
    loader: async () => {
      const { ExecutionDetail } = await import('./components/ExecutionDetail');
      return <ExecutionDetail />;
    },
  },
});

export const springBatchStepDetailPageExtension = PageBlueprint.make({
  name: 'spring-batch-step-detail',
  params: {
    path: '/spring-batch/steps/:stepId',
    loader: async () => {
      const { StepDetail } = await import('./components/StepDetail');
      return <StepDetail />;
    },
  },
});

export const springBatchExecuteJobPageExtension = PageBlueprint.make({
  name: 'spring-batch-execute-job',
  params: {
    path: '/spring-batch/execute',
    loader: async () => {
      const { ExecuteJobPage } = await import('./components/ExecuteJobPage');
      return <ExecuteJobPage />;
    },
  },
});

export default createFrontendPlugin({
  pluginId: 'spring-batch-dashboard',
  extensions: [
    springBatchApiExtension,
    springBatchPageExtension,
    springBatchJobInstancesPageExtension,
    springBatchJobExecutionsPageExtension,
    springBatchFailuresPageExtension,
    springBatchRetryHistoryPageExtension,
    springBatchExecutionDetailPageExtension,
    springBatchStepDetailPageExtension,
    springBatchExecuteJobPageExtension,
  ],
});
