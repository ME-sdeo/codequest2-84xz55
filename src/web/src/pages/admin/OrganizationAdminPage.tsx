/**
 * @fileoverview Organization Admin Page component with enhanced security,
 * tenant isolation, and comprehensive RBAC for organization management.
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Internal imports
import AdminLayout from '../../layouts/AdminLayout';
import OrganizationSettings from '../../components/settings/OrganizationSettings';
import { Role } from '../../types/common.types';
import { useAuth } from '../../hooks/useAuth';
import { sanitizeInput } from '../../utils/validation.utils';
import { setTenantHeaders } from '../../utils/api.utils';

// Styles
import styles from './OrganizationAdminPage.module.css';

// Props interface
interface OrganizationAdminPageProps {
  /** Flag to enable telemetry collection */
  telemetryEnabled?: boolean;
  /** Custom error boundary fallback UI */
  errorBoundaryFallback?: React.ReactNode;
}

/**
 * Enhanced Organization Admin Page with security features and tenant isolation
 */
const OrganizationAdminPage: React.FC<OrganizationAdminPageProps> = ({
  telemetryEnabled = true,
  errorBoundaryFallback
}) => {
  // Hooks
  const { organizationId } = useParams<{ organizationId: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates user access and tenant context
   */
  const validateAccess = useCallback(() => {
    if (!isAuthenticated || !user) {
      navigate('/auth/login');
      return false;
    }

    if (!organizationId) {
      setError('Invalid organization ID');
      return false;
    }

    // Validate organization ID format
    const sanitizedOrgId = sanitizeInput(organizationId);
    if (sanitizedOrgId !== organizationId) {
      setError('Invalid organization ID format');
      return false;
    }

    // Check role-based access
    const allowedRoles = [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.ORG_ADMIN];
    if (!allowedRoles.includes(user.role)) {
      navigate('/dashboard');
      return false;
    }

    // Validate tenant context
    if (user.role !== Role.SUPER_ADMIN && 
        user.organizationId !== organizationId) {
      setError('Invalid tenant context');
      return false;
    }

    return true;
  }, [isAuthenticated, user, organizationId, navigate]);

  /**
   * Initializes tenant context and security headers
   */
  const initializeTenantContext = useCallback(() => {
    try {
      if (!user?.companyId || !organizationId) {
        throw new Error('Invalid tenant context');
      }

      // Set tenant headers for API requests
      setTenantHeaders(user.companyId, organizationId);

      // Log access for audit trail
      if (telemetryEnabled) {
        console.info('Organization admin page accessed', {
          organizationId,
          userId: user.id,
          role: user.role,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Tenant context initialization failed:', error);
      setError('Failed to initialize tenant context');
    }
  }, [user, organizationId, telemetryEnabled]);

  // Effect for access validation and initialization
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setIsLoading(true);
        
        if (!validateAccess()) {
          return;
        }

        initializeTenantContext();
      } catch (error) {
        console.error('Initialization error:', error);
        toast.error('Failed to initialize organization admin page');
      } finally {
        setIsLoading(false);
      }
    };

    initializeComponent();
  }, [validateAccess, initializeTenantContext]);

  // Error state
  if (error) {
    return errorBoundaryFallback || (
      <div className={styles.errorContainer} role="alert">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer} role="status">
        <span>Loading organization settings...</span>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Organization Administration</h1>
        </header>

        {user && organizationId && (
          <OrganizationSettings
            organizationId={organizationId}
            userRole={user.role}
            tenantContext={{
              companyId: user.companyId,
              organizationId: organizationId
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
};

// Add display name for debugging
OrganizationAdminPage.displayName = 'OrganizationAdminPage';

// Export the component
export default OrganizationAdminPage;

// CSS Module styles
const styles = {
  container: {
    padding: 'var(--spacing-6)',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%'
  },
  header: {
    marginBottom: 'var(--spacing-6)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  errorContainer: {
    padding: 'var(--spacing-4)',
    backgroundColor: 'var(--color-error-bg)',
    borderRadius: 'var(--border-radius-md)',
    marginBottom: 'var(--spacing-4)',
    color: 'var(--color-error-text)'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px'
  }
} as const;