import React, { useState, useCallback, useEffect, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { DashboardHeader, DashboardHeaderProps } from './DashboardHeader';
import { DashboardSidebar, DashboardSidebarProps } from './DashboardSidebar';
import { useAuth } from '@/hooks/useAuth';
import styles from './DashboardLayout.module.css';

export interface DashboardLayoutProps {
  /** Content to be rendered in the main area */
  children: React.ReactNode;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** ARIA role for accessibility */
  role?: string;
}

/**
 * Custom hook for managing responsive layout behavior
 * @returns Layout configuration based on screen size
 */
const useResponsiveLayout = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 600 && window.innerWidth < 1240);
  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 600);
      setIsTablet(width >= 600 && width < 1240);
      setIsSidebarVisible(width >= 600);
    };

    // Add event listeners with passive option for better performance
    window.addEventListener('resize', handleResize, { passive: true });
    window.matchMedia('(orientation: portrait)').addListener(handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.matchMedia('(orientation: portrait)').removeListener(handleResize);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isSidebarVisible,
    setIsSidebarVisible
  };
};

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" className={styles.errorContainer}>
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
  </div>
);

/**
 * DashboardLayout component implementing an enterprise-grade dashboard layout
 * with responsive behavior and accessibility features
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className,
  role = 'main'
}) => {
  const { user, isAuthenticated } = useAuth();
  const {
    isMobile,
    isTablet,
    isSidebarVisible,
    setIsSidebarVisible
  } = useResponsiveLayout();

  // Memoized header props
  const headerProps = useMemo<DashboardHeaderProps>(() => ({
    showNotifications: true,
    onNotificationsClick: () => {/* Handle notifications */},
    ssoProvider: user?.ssoData?.provider,
    isOffline: !navigator.onLine
  }), [user]);

  // Memoized sidebar props
  const sidebarProps = useMemo<DashboardSidebarProps>(() => ({
    isVisible: isSidebarVisible,
    onClose: () => setIsSidebarVisible(false)
  }), [isSidebarVisible]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isMobile && isSidebarVisible) {
      setIsSidebarVisible(false);
    }
  }, [isMobile, isSidebarVisible]);

  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {/* Handle online status */};
    const handleOffline = () => {/* Handle offline status */};

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div 
        className={classNames(
          styles.layout,
          {
            [styles.mobile]: isMobile,
            [styles.tablet]: isTablet,
            [styles.sidebarVisible]: isSidebarVisible
          },
          className
        )}
      >
        <DashboardHeader {...headerProps} />
        
        <div className={styles.container}>
          <DashboardSidebar {...sidebarProps} />
          
          <main
            role={role}
            className={styles.content}
            id="main-content"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Add display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;