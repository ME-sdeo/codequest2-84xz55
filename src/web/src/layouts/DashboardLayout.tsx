import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom'; // v6.4.0
import { useMediaQuery } from '@mui/material'; // v5.0.0
import classNames from 'classnames'; // v2.3.0
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Props interface with strict typing
export interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  disableSidebar?: boolean;
}

/**
 * Enterprise-grade dashboard layout component implementing Material Design 3
 * with responsive behavior, authentication protection, and accessibility support.
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = React.memo(({
  children,
  className,
  disableSidebar = false
}) => {
  // Authentication state
  const { isAuthenticated, user } = useAuth();

  // Responsive breakpoint detection
  const isMobile = useMediaQuery('(max-width: 600px)');
  const isTablet = useMediaQuery('(min-width: 601px) and (max-width: 1024px)');

  // Sidebar visibility state
  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);

  // Handle sidebar visibility based on screen size
  useEffect(() => {
    setIsSidebarVisible(!isMobile);
  }, [isMobile]);

  // Memoized sidebar toggle handler with debounce
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarVisible(prev => !prev);
    // Apply body scroll lock on mobile when sidebar is open
    if (isMobile) {
      document.body.style.overflow = !isSidebarVisible ? 'hidden' : '';
    }
  }, [isMobile, isSidebarVisible]);

  // Cleanup effect for body scroll lock
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Memoized layout classes
  const layoutClasses = useMemo(() => 
    classNames(
      'layout',
      {
        'layout--sidebar-visible': isSidebarVisible && !disableSidebar,
        'layout--mobile': isMobile,
        'layout--tablet': isTablet
      },
      className
    ),
    [isSidebarVisible, disableSidebar, isMobile, isTablet, className]
  );

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="error-boundary">
          Something went wrong with the dashboard layout.
        </div>
      }
    >
      <div className={layoutClasses}>
        <DashboardHeader
          className="layout__header"
          onSidebarToggle={!disableSidebar ? handleSidebarToggle : undefined}
          showNotifications
          ssoProvider={user?.ssoData?.provider}
        />

        <main className="layout__main">
          {!disableSidebar && (
            <DashboardSidebar
              className="layout__sidebar"
              isVisible={isSidebarVisible}
              onClose={() => isMobile && setIsSidebarVisible(false)}
            />
          )}

          <div 
            className="layout__content"
            role="main"
            aria-label="Main content"
          >
            {children}
          </div>

          {/* Mobile overlay for sidebar */}
          {isMobile && isSidebarVisible && !disableSidebar && (
            <div
              className="layout__overlay"
              onClick={() => setIsSidebarVisible(false)}
              role="presentation"
              aria-hidden="true"
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
});

// Add display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

// Export component and props interface
export default DashboardLayout;

// CSS Module styles
const styles = {
  '.layout': {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--color-background)',
    position: 'relative',
    isolation: 'isolate'
  },

  '.layout__header': {
    position: 'sticky',
    top: 0,
    zIndex: 'var(--z-index-header)',
    backgroundColor: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)'
  },

  '.layout__main': {
    display: 'flex',
    flex: 1,
    height: 'calc(100vh - var(--header-height))',
    position: 'relative'
  },

  '.layout__sidebar': {
    position: 'sticky',
    top: 'var(--header-height)',
    height: 'calc(100vh - var(--header-height))',
    overflowY: 'auto',
    transition: 'transform var(--transition-duration) var(--transition-timing)',
    zIndex: 'var(--z-index-sidebar)',
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    '@media (max-width: 600px)': {
      position: 'fixed',
      top: 'var(--header-height)',
      left: 0,
      bottom: 0,
      transform: 'translateX(-100%)'
    }
  },

  '.layout--sidebar-visible .layout__sidebar': {
    '@media (max-width: 600px)': {
      transform: 'translateX(0)'
    }
  },

  '.layout__content': {
    flex: 1,
    padding: 'var(--spacing-6)',
    overflow: 'auto',
    scrollBehavior: 'smooth',
    '-webkit-overflow-scrolling': 'touch'
  },

  '.layout__overlay': {
    position: 'fixed',
    top: 'var(--header-height)',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--color-overlay)',
    opacity: 0,
    transition: 'opacity var(--transition-duration) var(--transition-timing)',
    pointerEvents: 'none',
    zIndex: 'var(--z-index-overlay)',
    '@media (max-width: 600px)': {
      opacity: 1,
      pointerEvents: 'auto'
    }
  },

  '.error-boundary': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: 'var(--spacing-4)',
    color: 'var(--color-error)',
    backgroundColor: 'var(--color-background)'
  }
} as const;