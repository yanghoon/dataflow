import React, { useEffect } from 'react';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import {
  SearchModal,
  SearchModalProvider,
  useSearchModal,
} from '@backstage/plugin-search';

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === 'dark';

  return {
    wrapper: {
      width: '100%',
      padding: '4px 8px 8px 8px',
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      height: 32,
      padding: '0 8px',
      borderRadius: 6,
      cursor: 'pointer',
      userSelect: 'none',
      outline: 'none',
      border: isDark
        ? '1px solid rgba(255, 255, 255, 0.12)'
        : '1px solid #EAEAEA',
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(0, 0, 0, 0.02)',
      color: '#888888',
      transition: 'background 120ms ease, border-color 120ms ease',
      '&:hover': {
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.07)'
          : 'rgba(0, 0, 0, 0.04)',
      },
      '&:focus-visible': {
        boxShadow: '0 0 0 2px #0070F3',
      },
    },
    left: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      overflow: 'hidden',
    },
    searchIcon: {
      fontSize: 15,
      width: 15,
      height: 15,
      color: isDark ? '#8E8E8E' : '#888888',
      flexShrink: 0,
    },
    placeholder: {
      fontSize: '12px',
      lineHeight: '16px',
      color: '#888888',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    kbd: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 18,
      padding: '0 4px',
      borderRadius: 4,
      fontSize: '10px',
      fontFamily: "'Geist Mono', Menlo, Monaco, monospace",
      lineHeight: 1,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.07)'
        : 'rgba(0, 0, 0, 0.04)',
      border: isDark
        ? '1px solid rgba(255, 255, 255, 0.12)'
        : '1px solid #EAEAEA',
      color: isDark ? '#888888' : '#666666',
      flexShrink: 0,
    },
  };
});

const SearchTriggerContent: React.FC = () => {
  const classes = useStyles();
  useTheme();
  const { state, toggleModal } = useSearchModal();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleModal]);

  return (
    <div className={classes.wrapper}>
      <button
        type="button"
        className={classes.button}
        onClick={toggleModal}
        aria-label="Search resources"
      >
        <div className={classes.left}>
          <SearchIcon className={classes.searchIcon} />
          <span className={classes.placeholder}>Search resources...</span>
        </div>
        <kbd className={classes.kbd}>⌘K</kbd>
      </button>
      <SearchModal {...state} toggleModal={toggleModal} />
    </div>
  );
};

export const SidebarSearchTrigger: React.FC = () => {
  return (
    <SearchModalProvider>
      <SearchTriggerContent />
    </SearchModalProvider>
  );
};
