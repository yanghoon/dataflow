import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'spring-batch',
});

export const instancesRouteRef = createSubRouteRef({
  id: 'spring-batch:instances',
  parent: rootRouteRef,
  path: '/instances',
});

export const executionsRouteRef = createSubRouteRef({
  id: 'spring-batch:executions',
  parent: rootRouteRef,
  path: '/executions',
});

export const failuresRouteRef = createSubRouteRef({
  id: 'spring-batch:failures',
  parent: rootRouteRef,
  path: '/failures',
});

export const retryHistoryRouteRef = createSubRouteRef({
  id: 'spring-batch:retry-history',
  parent: rootRouteRef,
  path: '/instances/:instanceId/history',
});

export const executionDetailRouteRef = createSubRouteRef({
  id: 'spring-batch:execution-detail',
  parent: rootRouteRef,
  path: '/executions/:id',
});

export const stepDetailRouteRef = createSubRouteRef({
  id: 'spring-batch:step-detail',
  parent: rootRouteRef,
  path: '/steps/:stepId',
});

export const executeJobRouteRef = createSubRouteRef({
  id: 'spring-batch:execute-job',
  parent: rootRouteRef,
  path: '/execute',
});
