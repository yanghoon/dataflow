import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';

import { springBatchFrontendPlugin } from '@jikwan/backstage-plugin-spring-batch-dashboard/src';

export default createApp({
  features: [
    catalogPlugin, navModule,
    springBatchFrontendPlugin,
  ],
});
