import React from 'react';
import { NavLink } from 'react-router-dom';
import { makeStyles, useTheme } from '@material-ui/core/styles';

export interface VercelSidebarItemProps {
  to: string;
  icon:
    | React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    | React.ReactNode;
  text: string;
  badge?: string | number;
}

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === 'dark';

  return {
    item: {
      display: 'flex',
      alignItems: 'center',
      height: 34,
      padding: '0 8px',
      borderRadius: 6,
      gap: 8,
      textDecoration: 'none',
      cursor: 'pointer',
      userSelect: 'none',
      outline: 'none',
      transition: 'background 120ms ease, color 120ms ease, stroke 120ms ease, box-shadow 120ms ease',
      color: isDark ? '#A1A1A1' : '#666666',
      backgroundColor: 'transparent',
      marginBottom: 2,
      '&:hover': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        color: isDark ? '#EDEDED' : '#171717',
        '& $icon': {
          color: isDark ? '#EDEDED' : '#171717',
        },
      },
      '&:focus-visible': {
        boxShadow: '0 0 0 2px #0070F3',
      },
    },
    active: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08) !important' : 'rgba(0, 0, 0, 0.06) !important',
      color: isDark ? '#FFFFFF !important' : '#000000 !important',
      boxShadow: isDark
        ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)'
        : 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
      '& $label': {
        fontWeight: 500,
      },
      '& $icon': {
        color: isDark ? '#FFFFFF !important' : '#000000 !important',
      },
    },
    iconWrapper: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      flexShrink: 0,
    },
    icon: {
      fontSize: 16,
      width: 16,
      height: 16,
      color: isDark ? '#8E8E8E' : '#666666',
      transition: 'color 120ms ease',
    },
    label: {
      fontSize: '13px',
      lineHeight: '20px',
      letterSpacing: '-0.01em',
      fontWeight: 400,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      flex: 1,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 18,
      minWidth: 18,
      padding: '0 6px',
      borderRadius: 9999,
      fontSize: '11px',
      fontWeight: 500,
      lineHeight: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
      color: isDark ? '#A1A1A1' : '#444444',
    },
  };
});

export const VercelSidebarItem: React.FC<VercelSidebarItemProps> = ({
  to,
  icon,
  text,
  badge,
}) => {
  const classes = useStyles();
  useTheme();

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon as React.ReactElement<any>, {
        className: classes.icon,
        style: { fontSize: 16, width: 16, height: 16 },
      });
    }
    if (typeof icon === 'function') {
      const IconComponent = icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
      return <IconComponent className={classes.icon} style={{ fontSize: 16, width: 16, height: 16 }} />;
    }
    return null;
  };

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${classes.item} ${isActive ? classes.active : ''}`
      }
    >
      <span className={classes.iconWrapper}>
        {renderIcon()}
      </span>
      <span className={classes.label}>{text}</span>
      {badge !== undefined && <span className={classes.badge}>{badge}</span>}
    </NavLink>
  );
};
