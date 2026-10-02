import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef, jobRunRouteRef, scheduleRouteRef } from './routes';
import { batchConsoleApiRef, BatchConsoleApiClient } from './api/BatchConsoleApi';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

import { createApiFactory } from '@backstage/core-plugin-api';

export const batchConsoleApi = ApiBlueprint.make({
  params: (defineParams) => defineParams(
    createApiFactory({
      api: batchConsoleApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) => new BatchConsoleApiClient({ discoveryApi, fetchApi }),
    })
  ),
});

export const batchJobsPage = PageBlueprint.make({
  name: 'batchJobs',
  params: {
    path: '/platform/batch/jobs',
    routeRef: rootRouteRef,
    loader: () => import('./components/BatchJobsPage').then(m => <m.BatchJobsPage />),
  },
});

export const batchConsolePage = batchJobsPage;

export const jobRunPage = PageBlueprint.make({
  name: 'jobRun',
  params: {
    path: '/platform/batch/jobs/:jobName',
    routeRef: jobRunRouteRef,
    loader: () => import('./components/JobRunPage').then(m => <m.JobRunPage />),
  },
});

export const schedulePage = PageBlueprint.make({
  name: 'schedulePage',
  params: {
    path: '/platform/batch/schedules',
    routeRef: scheduleRouteRef,
    loader: () => import('./components/SchedulePage').then(m => <m.SchedulePage />),
  },
});

export const batchConsolePlugin = createFrontendPlugin({
  pluginId: 'batch-console',
  extensions: [batchConsolePage, jobRunPage, schedulePage, batchConsoleApi],
  routes: {
    root: rootRouteRef,
    jobRun: jobRunRouteRef,
    schedules: scheduleRouteRef,
  }
});
