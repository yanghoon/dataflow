import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Tooltip from '@material-ui/core/Tooltip';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import Brightness7Icon from '@material-ui/icons/Brightness7';
import PersonIcon from '@material-ui/icons/Person';
import { appThemeApiRef, identityApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === 'dark';

  return {
    root: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 40,
      padding: '0 8px',
      borderRadius: 6,
      transition: 'background 120ms ease',
      marginTop: 4,
    },
    userLink: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      textDecoration: 'none',
      overflow: 'hidden',
      flex: 1,
      minWidth: 0,
      outline: 'none',
      borderRadius: 4,
      padding: '4px 0',
      '&:hover $userName': {
        color: isDark ? '#FFFFFF' : '#000000',
      },
      '&:focus-visible': {
        boxShadow: '0 0 0 2px #0070F3',
      },
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: '50%',
      border: isDark
        ? '1px solid rgba(255, 255, 255, 0.14)'
        : '1px solid #EAEAEA',
      objectFit: 'cover',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.04)',
      color: isDark ? '#EDEDED' : '#666666',
      flexShrink: 0,
      '& svg': {
        fontSize: 16,
      },
    },
    userName: {
      fontSize: '13px',
      fontWeight: 500,
      lineHeight: '16px',
      letterSpacing: '-0.01em',
      color: isDark ? '#EDEDED' : '#171717',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      transition: 'color 120ms ease',
    },
    themeBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      padding: 0,
      border: 'none',
      borderRadius: 4,
      backgroundColor: 'transparent',
      color: isDark ? '#8E8E8E' : '#666666',
      cursor: 'pointer',
      outline: 'none',
      flexShrink: 0,
      transition: 'color 120ms ease, background 120ms ease',
      '&:hover': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        color: isDark ? '#FFFFFF' : '#000000',
      },
      '&:focus-visible': {
        boxShadow: '0 0 0 2px #0070F3',
      },
      '& svg': {
        fontSize: 16,
      },
    },
  };
});

export const SidebarUserProfile: React.FC = () => {
  const classes = useStyles();
  useTheme();
  const identityApi = useApi(identityApiRef);
  const appThemeApi = useApi(appThemeApiRef);

  const [profile, setProfile] = useState<{ displayName?: string; picture?: string }>({});
  const [activeThemeId, setActiveThemeId] = useState<string | undefined>(
    appThemeApi.getActiveThemeId(),
  );

  useEffect(() => {
    identityApi.getProfileInfo().then(setProfile).catch(() => {});
  }, [identityApi]);

  useEffect(() => {
    const subscription = appThemeApi.activeThemeId$().subscribe(id => {
      setActiveThemeId(id);
    });
    return () => subscription.unsubscribe();
  }, [appThemeApi]);

  const isDarkMode =
    activeThemeId === 'vercel-dark' ||
    activeThemeId === 'dark' ||
    (!activeThemeId && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const handleToggleTheme = () => {
    const installed = appThemeApi.getInstalledThemes();
    if (isDarkMode) {
      const hasVercelLight = installed.some(t => t.id === 'vercel-light');
      appThemeApi.setActiveThemeId(hasVercelLight ? 'vercel-light' : 'light');
    } else {
      const hasVercelDark = installed.some(t => t.id === 'vercel-dark');
      appThemeApi.setActiveThemeId(hasVercelDark ? 'vercel-dark' : 'dark');
    }
  };

  const displayName = profile.displayName || 'Guest User';

  return (
    <div className={classes.root}>
      <Link to="/settings" className={classes.userLink} title="Go to Settings">
        {profile.picture ? (
          <img src={profile.picture} alt={displayName} className={classes.avatar} />
        ) : (
          <div className={classes.avatar}>
            <PersonIcon />
          </div>
        )}
        <span className={classes.userName}>{displayName}</span>
      </Link>
      <Tooltip
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        placement="top"
        arrow
      >
        <button
          type="button"
          onClick={handleToggleTheme}
          className={classes.themeBtn}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
        </button>
      </Tooltip>
    </div>
  );
};
