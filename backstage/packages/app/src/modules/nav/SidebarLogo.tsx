import React from 'react';
import { Link } from 'react-router-dom';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import UnfoldMoreIcon from '@material-ui/icons/UnfoldMore';

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === 'dark';

  return {
    root: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 44,
      padding: '0 8px',
      borderRadius: 6,
      textDecoration: 'none',
      cursor: 'pointer',
      userSelect: 'none',
      outline: 'none',
      marginBottom: 4,
      transition: 'background 120ms ease',
      '&:hover': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      },
      '&:focus-visible': {
        boxShadow: '0 0 0 2px #0070F3',
      },
    },
    brand: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    mark: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: 5,
      backgroundColor: isDark ? '#FFFFFF' : '#000000',
      color: isDark ? '#000000' : '#FFFFFF',
      flexShrink: 0,
    },
    triangle: {
      width: 0,
      height: 0,
      borderLeft: '5px solid transparent',
      borderRight: '5px solid transparent',
      borderBottom: `9px solid ${isDark ? '#000000' : '#FFFFFF'}`,
      transform: 'translateY(-1px)',
    },
    title: {
      fontSize: '13px',
      fontWeight: 600,
      letterSpacing: '-0.02em',
      color: isDark ? '#EDEDED' : '#171717',
      lineHeight: '18px',
    },
    orgBadge: {
      display: 'flex',
      alignItems: 'center',
      color: isDark ? '#707070' : '#888888',
      '& svg': {
        fontSize: 16,
      },
    },
  };
});

export const SidebarLogo: React.FC = () => {
  const classes = useStyles();
  useTheme();

  return (
    <Link to="/" className={classes.root} aria-label="Acme Portal Home">
      <div className={classes.brand}>
        <div className={classes.mark}>
          <div className={classes.triangle} />
        </div>
        <span className={classes.title}>Acme Portal</span>
      </div>
      <div className={classes.orgBadge}>
        <UnfoldMoreIcon />
      </div>
    </Link>
  );
};
