import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';

import { springBatchFrontendPlugin } from '@jikwan/backstage-plugin-spring-batch-dashboard/src';
import platformAdminPlugin from '@internal/plugin-platform-admin';
import batchConsolePlugin from '@internal/backstage-plugin-batch-console';
import { themeVercelPlugin, themeVercelModule } from '@internal/backstage-plugin-theme-vercel';

export default createApp({
  features: [
    catalogPlugin, navModule,
    springBatchFrontendPlugin,
    platformAdminPlugin,
    batchConsolePlugin,
    themeVercelPlugin,
    themeVercelModule,
  ],
});
