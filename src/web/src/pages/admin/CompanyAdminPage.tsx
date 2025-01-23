import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import AdminLayout from '../../layouts/AdminLayout';
import CompanySettings from '../../components/settings/CompanySettings';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types/common.types';
import styles from './CompanyAdminPage.module.css';

/**
 * Enhanced custom hook to verify company admin access with role validation
 * @returns Boolean indicating valid company admin access
 */
const useCompanyAdminAccess = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/auth/login');
      return;
    }

    const allowedRoles = [Role.SUPER_ADMIN, Role.COMPANY_ADMIN];
    if (!allowedRoles.includes(user.role)) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  return useMemo(() => ({
    hasAccess: isAuthenticated && user && [Role.SUPER_ADMIN, Role.COMPANY_ADMIN].includes(user.role),
    companyId: user?.companyId
  }), [isAuthenticated, user]);
};

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className={styles.errorContainer} role="alert">
    <h3>Something went wrong:</h3>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

/**
 * CompanyAdminPage component providing comprehensive company administration interface
 * with enhanced security and role-based access control
 */
const CompanyAdminPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { hasAccess, companyId } = useCompanyAdminAccess();

  // Handle settings update with audit logging
  const handleSettingsUpdate = useCallback(async (settings: any) => {
    try {
      // Log audit event for settings update
      await fetch('/api/v1/audit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'COMPANY_SETTINGS_UPDATE',
          userId: user?.id,
          companyId: companyId,
          details: {
            changes: settings,
            timestamp: new Date().toISOString()
          }
        })
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }, [user?.id, companyId]);

  if (!isAuthenticated || !hasAccess || !companyId) {
    return null;
  }

  return (
    <AdminLayout>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => navigate(0)}
      >
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>Company Administration</h1>
          </header>

          <main>
            <CompanySettings
              companyId={companyId}
              onSettingsUpdate={handleSettingsUpdate}
              isReadOnly={user?.role !== Role.COMPANY_ADMIN && user?.role !== Role.SUPER_ADMIN}
            />
          </main>
        </div>
      </ErrorBoundary>
    </AdminLayout>
  );
});

// Add display name for debugging
CompanyAdminPage.displayName = 'CompanyAdminPage';

export default CompanyAdminPage;