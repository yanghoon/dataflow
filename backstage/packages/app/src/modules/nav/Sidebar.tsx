import React from 'react';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import LayersIcon from '@material-ui/icons/Layers';
import AddBoxIcon from '@material-ui/icons/AddBox';
import BuildIcon from '@material-ui/icons/Build';
import WebIcon from '@material-ui/icons/Web';
import ExtensionIcon from '@material-ui/icons/Extension';
import ScheduleIcon from '@material-ui/icons/Schedule';
import SettingsIcon from '@material-ui/icons/Settings';
import NotificationsNoneIcon from '@material-ui/icons/NotificationsNone';

import { RequirePermission } from '@backstage/plugin-permission-react';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import {
  toolsReadPermission,
  sitesReadPermission,
  siteToolBindingsReadPermission,
} from '@internal/plugin-platform-admin';

import { SidebarLogo } from './SidebarLogo';
import { SidebarSearchTrigger } from './SidebarSearchTrigger';
import { VercelSidebarItem } from './VercelSidebarItem';
import { SidebarUserProfile } from './SidebarUserProfile';

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === 'dark';

  return {
    sidebar: {
      width: 240,
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      padding: '12px 8px 8px 8px',
      backgroundColor: isDark ? '#000000' : '#FFFFFF',
      borderRight: isDark
        ? '1px solid rgba(255, 255, 255, 0.10)'
        : '1px solid #EAEAEA',
      fontFamily: "'Geist Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    topArea: {
      flexShrink: 0,
    },
    scrollArea: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingRight: 2,
      '&::-webkit-scrollbar': {
        width: 4,
      },
      '&::-webkit-scrollbar-thumb': {
        borderRadius: 4,
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      },
    },
    sectionHeading: {
      fontSize: '11px',
      fontWeight: 500,
      lineHeight: '16px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      padding: '16px 8px 6px 8px',
      color: isDark ? '#707070' : '#666666',
      userSelect: 'none',
    },
    divider: {
      height: 1,
      border: 'none',
      margin: '6px 0',
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.06)',
    },
    bottomDock: {
      flexShrink: 0,
      marginTop: 'auto',
      paddingTop: 4,
    },
  };
});

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const classes = useStyles();
      useTheme();

      const nav = navItems.withComponent(item => (
        <VercelSidebarItem
          icon={item.icon}
          to={item.href}
          text={item.title}
        />
      ));

      // Items handled manually or skipped
      nav.take('page:search');
      nav.take('page:notifications');
      nav.take('page:spring-batch-dashboard');
      nav.take('page:spring-batch-dashboard/spring-batch-dashboard');
      nav.take('page:catalog');
      nav.take('page:scaffolder');
      nav.take('page:app-visualizer');
      nav.take('page:user-settings');

      const restItems = nav.rest({ sortBy: 'title' });

      return (
        <aside className={classes.sidebar} aria-label="Main Navigation">
          <div className={classes.topArea}>
            <SidebarLogo />
            <SidebarSearchTrigger />
          </div>

          <div className={classes.scrollArea}>
            {/* PLATFORM SECTION */}
            <div className={classes.sectionHeading}>Platform</div>
            <VercelSidebarItem
              to="/catalog"
              icon={LayersIcon}
              text="Software Catalog"
            />
            <VercelSidebarItem
              to="/create"
              icon={AddBoxIcon}
              text="Create (Templates)"
            />

            {/* OPERATIONS SECTION */}
            <div className={classes.sectionHeading}>Operations</div>
            <VercelSidebarItem
              to="/platform/batch/schedules"
              icon={ScheduleIcon}
              text="Spring Batch"
            />
            <RequirePermission permission={toolsReadPermission} errorPage={<></>}>
              <VercelSidebarItem
                to="/platform-tools"
                icon={BuildIcon}
                text="Platform Tools"
              />
            </RequirePermission>
            <RequirePermission permission={sitesReadPermission} errorPage={<></>}>
              <VercelSidebarItem
                to="/platform-sites"
                icon={WebIcon}
                text="Platform Sites"
              />
            </RequirePermission>
            <RequirePermission permission={siteToolBindingsReadPermission} errorPage={<></>}>
              <VercelSidebarItem
                to="/platform-sites/default/toolbindings"
                icon={ExtensionIcon}
                text="Tool Bindings"
              />
            </RequirePermission>

            {/* DYNAMIC EXTENSIONS */}
            {React.Children.count(restItems) > 0 && (
              <>
                <div className={classes.sectionHeading}>Other</div>
                {restItems}
              </>
            )}
          </div>

          <div className={classes.bottomDock}>
            <hr className={classes.divider} />
            <NotificationsSidebarItem
              renderItem={({ to, unreadCount }) => (
                <VercelSidebarItem
                  to={to}
                  icon={NotificationsNoneIcon}
                  text="Notifications"
                  badge={unreadCount > 0 ? unreadCount : undefined}
                />
              )}
            />
            <VercelSidebarItem
              to="/settings"
              icon={SettingsIcon}
              text="Settings"
            />
            <SidebarUserProfile />
          </div>
        </aside>
      );
    },
  },
});
