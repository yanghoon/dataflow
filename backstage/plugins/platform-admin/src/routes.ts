import { createRouteRef } from '@backstage/frontend-plugin-api';

export const rootRouteRef = createRouteRef();
export const toolsRouteRef = createRouteRef();
export const sitesRouteRef = createRouteRef();
export const siteToolBindingsRouteRef = createRouteRef({
  params: ['slug'],
});
