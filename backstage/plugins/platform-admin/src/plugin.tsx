import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { rootRouteRef, toolsRouteRef, sitesRouteRef } from './routes';
import BuildIcon from '@mui/icons-material/Build';
import WebIcon from '@mui/icons-material/Web';

export const ToolsPageExt = PageBlueprint.make({
  name: 'ToolsPage',
  params: {
    path: '/platform-tools',
    routeRef: toolsRouteRef,
    title: 'Platform Tools',
    icon: <BuildIcon />,
    loader: () => import('./components/ToolsPage').then(m => <m.ToolsPage />),
  },
});

export const SitesPageExt = PageBlueprint.make({
  name: 'SitesPage',
  params: {
    path: '/platform-sites',
    routeRef: sitesRouteRef,
    title: 'Platform Sites',
    icon: <WebIcon />,
    loader: () => import('./components/SitesPage').then(m => <m.SitesPage />),
  },
});

export const platformAdminPlugin = createFrontendPlugin({
  pluginId: 'platform-admin',
  routes: {
    root: rootRouteRef,
    tools: toolsRouteRef,
    sites: sitesRouteRef,
  },
  extensions: [
    ToolsPageExt,
    SitesPageExt,
  ]
});
