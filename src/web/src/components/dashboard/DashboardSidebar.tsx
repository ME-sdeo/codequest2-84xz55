import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import classNames from 'classnames';
import { DASHBOARD_ROUTES } from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types/common.types';

// Material Design 3 Icons (imported as SVG components)
import HomeIcon from '@mui/icons-material/Home';
import TimelineIcon from '@mui/icons-material/Timeline';
import GroupsIcon from '@mui/icons-material/Groups';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';

// Component interfaces
interface DashboardSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  className?: string;
}

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  requiredRoles: Role[];
}

/**
 * DashboardSidebar component that implements a responsive navigation sidebar
 * with role-based access control and Material Design 3 styling
 */
const DashboardSidebar: React.FC<DashboardSidebarProps> = React.memo(({ 
  isVisible, 
  onClose, 
  className 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 600px)');

  // Define navigation items with role-based access
  const navigationItems = useMemo<NavigationItem[]>(() => [
    {
      path: DASHBOARD_ROUTES.HOME,
      label: 'Dashboard',
      icon: <HomeIcon />,
      requiredRoles: [
        Role.SUPER_ADMIN,
        Role.COMPANY_ADMIN,
        Role.ORG_ADMIN,
        Role.DEVELOPER,
        Role.GENERAL_USER
      ]
    },
    {
      path: DASHBOARD_ROUTES.ACTIVITIES,
      label: 'Activities',
      icon: <TimelineIcon />,
      requiredRoles: [
        Role.SUPER_ADMIN,
        Role.COMPANY_ADMIN,
        Role.ORG_ADMIN,
        Role.DEVELOPER
      ]
    },
    {
      path: DASHBOARD_ROUTES.TEAMS,
      label: 'Teams',
      icon: <GroupsIcon />,
      requiredRoles: [
        Role.SUPER_ADMIN,
        Role.COMPANY_ADMIN,
        Role.ORG_ADMIN,
        Role.DEVELOPER
      ]
    },
    {
      path: DASHBOARD_ROUTES.LEADERBOARD,
      label: 'Leaderboard',
      icon: <EmojiEventsIcon />,
      requiredRoles: [
        Role.SUPER_ADMIN,
        Role.COMPANY_ADMIN,
        Role.ORG_ADMIN,
        Role.DEVELOPER,
        Role.GENERAL_USER
      ]
    },
    {
      path: DASHBOARD_ROUTES.ANALYTICS,
      label: 'Analytics',
      icon: <BarChartIcon />,
      requiredRoles: [
        Role.SUPER_ADMIN,
        Role.COMPANY_ADMIN,
        Role.ORG_ADMIN
      ]
    }
  ], []);

  // Filter navigation items based on user role
  const filteredNavigationItems = useMemo(() => {
    if (!user) return [];
    return navigationItems.filter(item => 
      item.requiredRoles.includes(user.role)
    );
  }, [navigationItems, user]);

  // Handle navigation item click
  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  };

  // Render sidebar with Material Design 3 styling
  return (
    <aside
      className={classNames(
        'sidebar',
        { 'hidden': !isVisible },
        className
      )}
      aria-hidden={!isVisible}
    >
      <nav className="navigation">
        {filteredNavigationItems.map(item => (
          <button
            key={item.path}
            className={classNames(
              'navItem',
              { 'active': location.pathname === item.path }
            )}
            onClick={() => handleNavigation(item.path)}
            aria-current={location.pathname === item.path ? 'page' : undefined}
          >
            <span className="icon">{item.icon}</span>
            <span className="label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
});

// Add display name for debugging
DashboardSidebar.displayName = 'DashboardSidebar';

// Export component and props interface
export type { DashboardSidebarProps };
export default DashboardSidebar;

// CSS Module styles
const styles = {
  '.sidebar': {
    display: 'flex',
    flexDirection: 'column',
    width: '240px',
    height: '100%',
    backgroundColor: 'var(--md-sys-color-surface)',
    borderRight: '1px solid var(--md-sys-color-outline)',
    transition: 'transform 0.3s var(--md-sys-motion-easing-emphasized)',
    position: 'fixed',
    top: 'var(--header-height)',
    left: '0',
    bottom: '0',
    zIndex: 'var(--z-index-sidebar)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    '@media (max-width: 600px)': {
      width: '100%',
      transform: 'translateX(-100%)'
    }
  },

  '.hidden': {
    transform: 'translateX(-100%)'
  },

  '.navigation': {
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--md-sys-spacing-2) 0'
  },

  '.navItem': {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--md-sys-spacing-2)',
    padding: 'var(--md-sys-spacing-3) var(--md-sys-spacing-4)',
    color: 'var(--md-sys-color-on-surface)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background-color 0.2s var(--md-sys-motion-easing-standard)',
    position: 'relative',
    '&:hover': {
      backgroundColor: 'var(--md-sys-color-surface-variant)'
    },
    '&:focus-visible': {
      outline: '2px solid var(--md-sys-color-primary)',
      outlineOffset: '-2px'
    }
  },

  '.active': {
    backgroundColor: 'var(--md-sys-color-secondary-container)',
    color: 'var(--md-sys-color-on-secondary-container)',
    '&::before': {
      content: '""',
      position: 'absolute',
      left: '0',
      top: '0',
      bottom: '0',
      width: '4px',
      backgroundColor: 'var(--md-sys-color-primary)'
    }
  },

  '.icon': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    color: 'inherit'
  },

  '.label': {
    fontFamily: 'var(--md-sys-typescale-label-large-font)',
    fontSize: 'var(--md-sys-typescale-label-large-size)',
    fontWeight: 'var(--md-sys-typescale-label-large-weight)',
    lineHeight: 'var(--md-sys-typescale-label-large-line-height)',
    letterSpacing: 'var(--md-sys-typescale-label-large-tracking)'
  }
} as const;