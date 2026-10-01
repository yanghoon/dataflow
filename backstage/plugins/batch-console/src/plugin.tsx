import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef, jobRunRouteRef } from './routes';
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

export const batchConsolePage = PageBlueprint.make({
  name: 'batchConsole',
  params: {
    path: '/platform/batch/jobs',
    routeRef: rootRouteRef,
    loader: () => import('./components/BatchConsolePage').then(m => <m.BatchConsolePage />),
  },
});

export const jobRunPage = PageBlueprint.make({
  name: 'jobRun',
  params: {
    path: '/platform/batch/jobs/:jobName',
    routeRef: jobRunRouteRef,
    loader: () => import('./components/JobRunPage').then(m => <m.JobRunPage />),
  },
});

export const batchConsolePlugin = createFrontendPlugin({
  pluginId: 'batch-console',
  extensions: [batchConsolePage, jobRunPage, batchConsoleApi],
  routes: {
    root: rootRouteRef,
    jobRun: jobRunRouteRef,
  }
});
