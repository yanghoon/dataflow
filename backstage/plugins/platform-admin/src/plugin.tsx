import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { rootRouteRef, toolsRouteRef, sitesRouteRef, siteToolBindingsRouteRef } from './routes';

export const ToolsPageExt = PageBlueprint.make({
  name: 'ToolsPage',
  params: {
    path: '/platform-tools',
    routeRef: toolsRouteRef,
    loader: () => import('./components/ToolsPage').then(m => <m.ToolsPage />),
  },
});

export const SitesPageExt = PageBlueprint.make({
  name: 'SitesPage',
  params: {
    path: '/platform-sites',
    routeRef: sitesRouteRef,
    loader: () => import('./components/SitesPage').then(m => <m.SitesPage />),
  },
});

export const SiteToolBindingsPageExt = PageBlueprint.make({
  name: 'SiteToolBindingsPage',
  params: {
    path: '/platform-sites/:slug/toolbindings',
    routeRef: siteToolBindingsRouteRef,
    loader: () => import('./components/SiteToolBindingsPage').then(m => <m.SiteToolBindingsPage />),
  },
});

export const platformAdminPlugin = createFrontendPlugin({
  pluginId: 'platform-admin',
  routes: {
    root: rootRouteRef,
    tools: toolsRouteRef,
    sites: sitesRouteRef,
    siteToolBindings: siteToolBindingsRouteRef,
  },
  extensions: [
    ToolsPageExt,
    SitesPageExt,
    SiteToolBindingsPageExt,
  ]
});
