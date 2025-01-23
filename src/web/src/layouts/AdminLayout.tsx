import React, { useState, useCallback, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import classNames from 'classnames';

// Internal components
import DashboardHeader, { DashboardHeaderProps } from '../components/dashboard/DashboardHeader';
import DashboardSidebar, { DashboardSidebarProps } from '../components/dashboard/DashboardSidebar';
import { Role } from '../types/common.types';
import { useAuth } from '../hooks/useAuth';

// Styles
import styles from './AdminLayout.module.css';

// Props interface
interface AdminLayoutProps {
  /** Child components to render in the main content area */
  children: React.ReactNode;
  /** Optional additional CSS classes */
  className?: string;
  /** SSO configuration for the header */
  ssoConfig?: {
    provider: string;
    displayName: string;
  };
  /** Performance configuration */
  performanceConfig?: {
    enableVirtualization?: boolean;
    deferredLoading?: boolean;
  };
}

/**
 * Enhanced AdminLayout component with SSO integration, role-based access,
 * and Material Design 3 principles
 */
const AdminLayout: React.FC<AdminLayoutProps> = memo(({
  children,
  className,
  ssoConfig,
  performanceConfig = {
    enableVirtualization: true,
    deferredLoading: true
  }
}) => {
  // Hooks
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const isMobile = useMediaQuery({ maxWidth: 599 });
  
  // State
  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);
  const [isLoading, setIsLoading] = useState(false);

  // Effect to handle responsive sidebar visibility
  useEffect(() => {
    setIsSidebarVisible(!isMobile);
  }, [isMobile]);

  // Effect to verify admin access
  useEffect(() => {
    const verifyAccess = async () => {
      if (!isAuthenticated || !user) {
        navigate('/auth/login');
        return;
      }

      const allowedRoles = [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.ORG_ADMIN];
      if (!allowedRoles.includes(user.role)) {
        navigate('/dashboard');
      }
    };

    verifyAccess();
  }, [isAuthenticated, user, navigate]);

  // Handlers
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
  }, []);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logout();
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigate]);

  // Early return if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div 
      className={classNames(
        styles.layout,
        { [styles.sidebarVisible]: isSidebarVisible },
        className
      )}
      role="application"
      aria-label="Admin dashboard layout"
    >
      <DashboardHeader
        className={styles.header}
        showNotifications
        ssoProvider={ssoConfig?.provider}
        onMenuClick={handleSidebarToggle}
        onLogout={handleLogout}
        isLoading={isLoading}
        user={user}
      />

      <div className={styles.content}>
        <DashboardSidebar
          className={classNames(
            styles.sidebar,
            { [styles.mobileSidebar]: isMobile }
          )}
          isVisible={isSidebarVisible}
          onClose={() => setIsSidebarVisible(false)}
        />

        <main 
          className={styles.main}
          role="main"
          aria-label="Admin content area"
        >
          {performanceConfig.deferredLoading ? (
            <React.Suspense fallback={<div>Loading...</div>}>
              {children}
            </React.Suspense>
          ) : children}
        </main>
      </div>
    </div>
  );
});

// Add display name for debugging
AdminLayout.displayName = 'AdminLayout';

// Custom hook for admin access verification
export const useAdminAccess = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/auth/login');
      return;
    }

    const allowedRoles = [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.ORG_ADMIN];
    if (!allowedRoles.includes(user.role)) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  return {
    isAdmin: isAuthenticated && user && [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.ORG_ADMIN].includes(user.role),
    user,
  };
};

export type { AdminLayoutProps };
export default AdminLayout;