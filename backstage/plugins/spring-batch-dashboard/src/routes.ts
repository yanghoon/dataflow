import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'spring-batch',
});

export const executionDetailRouteRef = createSubRouteRef({
  id: 'spring-batch:execution-detail',
  parent: rootRouteRef,
  path: '/executions/:id',
});
