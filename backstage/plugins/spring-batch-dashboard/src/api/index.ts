import { createApiRef } from '@backstage/core-plugin-api';
import { SpringBatchClient } from './SpringBatchClient';

export const springBatchApiRef = createApiRef<SpringBatchClient>({
  id: 'plugin.spring-batch.service',
});

export { SpringBatchClient };
