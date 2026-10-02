import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import { RequirePermission } from '@backstage/plugin-permission-react';
import BuildIcon from '@material-ui/icons/Build';
import WebIcon from '@material-ui/icons/Web';
import ExtensionIcon from '@material-ui/icons/Extension';
import ScheduleIcon from '@material-ui/icons/Schedule';
import { toolsReadPermission, sitesReadPermission, siteToolBindingsReadPermission } from '@internal/plugin-platform-admin';

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const nav = navItems.withComponent(item => (
        <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
      ));

      // Skipped items
      nav.take('page:search'); // Using search modal instead
      nav.take('page:notifications'); // Using NotificationsSidebarItem manually instead
      nav.take('page:spring-batch-dashboard');
      nav.take('page:spring-batch-dashboard/spring-batch-dashboard');

      return (
        <Sidebar>
          <SidebarLogo />
          <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarDivider />
          <SidebarGroup label="Menu" icon={<MenuIcon />}>
            {nav.take('page:catalog')}
            {nav.take('page:scaffolder')}
            <RequirePermission permission={toolsReadPermission} errorPage={<></>}>
              <SidebarItem icon={BuildIcon} to="/platform-tools" text="Tools" />
            </RequirePermission>
            <RequirePermission permission={sitesReadPermission} errorPage={<></>}>
              <SidebarItem icon={WebIcon} to="/platform-sites" text="Sites" />
            </RequirePermission>
            <RequirePermission permission={siteToolBindingsReadPermission} errorPage={<></>}>
              <SidebarItem icon={ExtensionIcon} to="/platform-sites/default/toolbindings" text="Tool Bindings" />
            </RequirePermission>
            <SidebarItem icon={ScheduleIcon} to="/platform/batch/schedules" text="Spring Batch" />
            <SidebarDivider />
            <SidebarScrollWrapper>
              {nav.rest({ sortBy: 'title' })}
            </SidebarScrollWrapper>
          </SidebarGroup>
          <SidebarSpace />
          <SidebarDivider />
          <NotificationsSidebarItem />
          <SidebarDivider />
          <SidebarGroup
            label="Settings"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            {nav.take('page:app-visualizer')}
            {nav.take('page:user-settings')}
          </SidebarGroup>
        </Sidebar>
      );
    },
  },
});
