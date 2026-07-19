import {
  createPlugin,
  createRoutableExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';
import {
  SpringBatchClient,
  SpringBatchUpstreamClient,
  springBatchApiRef,
  springBatchUpstreamApiRef,
} from './api';

export const springBatchPlugin = createPlugin({
  id: 'spring-batch-dashboard',
  apis: [
    createApiFactory({
      api: springBatchApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new SpringBatchClient({ discoveryApi, fetchApi }),
    }),
    createApiFactory({
      api: springBatchUpstreamApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new SpringBatchUpstreamClient({ discoveryApi, fetchApi }),
    }),
  ],
  routes: {
    root: rootRouteRef,
  },
});

export const SpringBatchPage = springBatchPlugin.provide(
  createRoutableExtension({
    name: 'SpringBatchPage',
    component: () =>
      import('./components/SpringBatchPage').then(m => m.SpringBatchPage),
    mountPoint: rootRouteRef,
  }),
);

export const SpringBatchExecutionDetail = springBatchPlugin.provide(
  createRoutableExtension({
    name: 'SpringBatchExecutionDetail',
    component: () =>
      import('./components/ExecutionDetail').then(m => m.ExecutionDetail),
    mountPoint: rootRouteRef,
  }),
);

export const SpringBatchFailuresPage = springBatchPlugin.provide(
  createRoutableExtension({
    name: 'SpringBatchFailuresPage',
    component: () =>
      import('./components/FailuresPage').then(m => m.FailuresPage),
    mountPoint: rootRouteRef,
  }),
);

export const SpringBatchRetryHistoryPage = springBatchPlugin.provide(
  createRoutableExtension({
    name: 'SpringBatchRetryHistoryPage',
    component: () =>
      import('./components/RetryHistoryPage').then(m => m.RetryHistoryPage),
    mountPoint: rootRouteRef,
  }),
);

export const SpringBatchJobInstancesPage = springBatchPlugin.provide(
  createRoutableExtension({
    name: 'SpringBatchJobInstancesPage',
    component: () =>
      import('./components/JobInstancesPage').then(m => m.JobInstancesPage),
    mountPoint: rootRouteRef,
  }),
);

export const SpringBatchJobExecutionsPage = springBatchPlugin.provide(
  createRoutableExtension({
    name: 'SpringBatchJobExecutionsPage',
    component: () =>
      import('./components/JobExecutionsPage').then(m => m.JobExecutionsPage),
    mountPoint: rootRouteRef,
  }),
);

export const SpringBatchStepDetail = springBatchPlugin.provide(
  createRoutableExtension({
    name: 'SpringBatchStepDetail',
    component: () => import('./components/StepDetail').then(m => m.StepDetail),
    mountPoint: rootRouteRef,
  }),
);

export const SpringBatchExecuteJobPage = springBatchPlugin.provide(
  createRoutableExtension({
    name: 'SpringBatchExecuteJobPage',
    component: () => import('./components/ExecuteJobPage').then(m => m.ExecuteJobPage),
    mountPoint: rootRouteRef,
  }),
);
