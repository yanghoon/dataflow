import { createApiRef } from '@backstage/core-plugin-api';
import { SpringBatchClient } from './SpringBatchClient';
import { SpringBatchUpstreamClient } from './SpringBatchUpstreamClient';

export const springBatchApiRef = createApiRef<SpringBatchClient>({
  id: 'plugin.spring-batch.service',
});

export const springBatchUpstreamApiRef = createApiRef<SpringBatchUpstreamClient>({
  id: 'plugin.spring-batch.upstream-service',
});

export { SpringBatchClient, SpringBatchUpstreamClient };
