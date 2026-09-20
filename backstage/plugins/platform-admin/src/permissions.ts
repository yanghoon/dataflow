import { createPermission } from '@backstage/plugin-permission-common';

export const toolsReadPermission = createPermission({
  name: 'platform.tools.read',
  attributes: { action: 'read' },
});

export const sitesReadPermission = createPermission({
  name: 'platform.sites.read',
  attributes: { action: 'read' },
});

export const siteToolBindingsReadPermission = createPermission({
  name: 'platform.sites.toolbindings.read',
  attributes: { action: 'read' },
});

export const platformAdminPermissions = [
  toolsReadPermission,
  sitesReadPermission,
  siteToolBindingsReadPermission,
];
