import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef } from './routes';

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
  extensions: [page],
  routes: {
    root: rootRouteRef,
  }
});
