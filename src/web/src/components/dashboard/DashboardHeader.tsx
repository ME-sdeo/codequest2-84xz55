import React, { useEffect, useCallback, useState, memo } from 'react';
import classNames from 'classnames'; // v2.3.0
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import Dropdown, { DropdownItem } from '../common/Dropdown';
import { useAuth } from '../../hooks/useAuth';
import styles from './DashboardHeader.module.css';

interface DashboardHeaderProps {
  /** Optional class name for custom styling */
  className?: string;
  /** Flag to show/hide notifications */
  showNotifications?: boolean;
  /** Handler for notification click */
  onNotificationsClick?: () => void;
  /** SSO provider name for display */
  ssoProvider?: string;
  /** Flag indicating offline status */
  isOffline?: boolean;
  /** Optional custom actions to render */
  customActions?: React.ReactNode;
}

/**
 * Enterprise-grade dashboard header component with SSO integration
 * and Material Design 3 principles
 */
const DashboardHeader: React.FC<DashboardHeaderProps> = memo(({
  className,
  showNotifications = true,
  onNotificationsClick,
  ssoProvider,
  isOffline = false,
  customActions,
}) => {
  // Authentication state and handlers
  const { user, isAuthenticated, logout, refreshSession } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Session refresh interval
  useEffect(() => {
    if (isAuthenticated) {
      const refreshInterval = setInterval(refreshSession, 300000); // 5 minutes
      return () => clearInterval(refreshInterval);
    }
  }, [isAuthenticated, refreshSession]);

  // Handle secure logout
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout]);

  // Profile menu items with ARIA support
  const profileMenuItems = [
    {
      label: 'Profile Settings',
      value: 'profile',
      icon: '👤',
    },
    {
      label: `SSO: ${ssoProvider || 'Not Connected'}`,
      value: 'sso',
      icon: '🔒',
      disabled: !ssoProvider,
    },
    {
      label: 'Logout',
      value: 'logout',
      icon: '🚪',
    },
  ];

  // Handle profile menu selection
  const handleProfileAction = useCallback((value: string) => {
    switch (value) {
      case 'logout':
        handleLogout();
        break;
      case 'profile':
        // Navigate to profile
        break;
      case 'sso':
        // Handle SSO settings
        break;
    }
    setIsProfileOpen(false);
  }, [handleLogout]);

  return (
    <header
      className={classNames(
        styles.header,
        {
          [styles.offline]: isOffline,
        },
        className
      )}
      role="banner"
    >
      {/* Logo and branding section */}
      <div className={styles.logo}>
        <img
          src="/logo.svg"
          alt="CodeQuest"
          width="32"
          height="32"
          className={styles.logoImage}
        />
        <span className={styles.logoText}>CodeQuest</span>
      </div>

      {/* Navigation section */}
      <nav className={styles.navigation} role="navigation">
        <Button
          variant="outlined"
          size="md"
          className={styles.navButton}
          ariaLabel="View Teams"
        >
          Teams
        </Button>
        <Button
          variant="outlined"
          size="md"
          className={styles.navButton}
          ariaLabel="View Leaderboard"
        >
          Leaderboard
        </Button>
        <Button
          variant="outlined"
          size="md"
          className={styles.navButton}
          ariaLabel="View Points"
        >
          Points
        </Button>
      </nav>

      {/* Actions section */}
      <div className={styles.actions}>
        {customActions}
        
        {showNotifications && (
          <Button
            variant="outlined"
            size="md"
            className={styles.notificationButton}
            onClick={onNotificationsClick}
            ariaLabel={`${unreadCount} unread notifications`}
          >
            {unreadCount > 0 && (
              <span className={styles.badge} aria-hidden="true">
                {unreadCount}
              </span>
            )}
            <span className={styles.notificationIcon} aria-hidden="true">
              🔔
            </span>
          </Button>
        )}

        {/* User profile section */}
        <div className={styles.userSection}>
          {isOffline && (
            <span className={styles.offlineIndicator} role="status">
              Offline
            </span>
          )}
          
          <Dropdown
            options={profileMenuItems}
            value=""
            onChange={handleProfileAction}
            className={styles.profileDropdown}
            isOpen={isProfileOpen}
            onOpenChange={setIsProfileOpen}
            ariaLabel="User profile menu"
          >
            <Avatar
              src={user?.ssoData?.metadata?.picture}
              alt={user?.email}
              name={user?.email}
              size="medium"
              clickable
              ariaLabel="Open profile menu"
            />
          </Dropdown>
        </div>
      </div>
    </header>
  );
});

DashboardHeader.displayName = 'DashboardHeader';

export type { DashboardHeaderProps };
export default DashboardHeader;