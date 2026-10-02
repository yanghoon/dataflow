import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({ id: 'batch-console' });

export const jobRunRouteRef = createRouteRef({ id: 'batch-console:jobRun', params: ['jobName'] });

export const scheduleRouteRef = createRouteRef({ id: 'batch-console:schedules' });
