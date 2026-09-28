import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';

import { createApiFactory, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { settingsApiRef, SettingsApiClient } from './api';

import { rootRouteRef } from './routes';

export const api = ApiBlueprint.make({
  params: factory => factory(
    createApiFactory({
      api: settingsApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) => new SettingsApiClient({ discoveryApi, fetchApi }),
    })
  ),
});

export const page = PageBlueprint.make({
  params: {
    path: '/settings',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/SettingsPage').then(m => (
        <m.SettingsPage />
      )),
  },
});

export const settingsPlugin = createFrontendPlugin({
  pluginId: 'settings',
  extensions: [api, page],
  routes: {
    root: rootRouteRef,
  }
});
