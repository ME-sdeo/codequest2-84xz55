/**
 * @fileoverview Enhanced settings page component with strict role-based access control,
 * tenant isolation, and performance optimizations for CodeQuest platform.
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import CompanySettings from '../../components/settings/CompanySettings';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/common/Card';
import { Role } from '../../types/common.types';

// Lazy loaded components for performance optimization
const OrganizationSettings = React.lazy(() => import('../../components/settings/OrganizationSettings'));
const TeamSettings = React.lazy(() => import('../../components/settings/TeamSettings'));
const PointsSettings = React.lazy(() => import('../../components/settings/PointsSettings'));

// Enum for settings tabs with associated permissions
enum SettingsTab {
  COMPANY = 'company',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  POINTS = 'points'
}

// Permission mapping for settings tabs
const TAB_PERMISSIONS: Record<SettingsTab, Role[]> = {
  [SettingsTab.COMPANY]: [Role.SUPER_ADMIN, Role.COMPANY_ADMIN],
  [SettingsTab.ORGANIZATION]: [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.ORG_ADMIN],
  [SettingsTab.TEAM]: [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.ORG_ADMIN],
  [SettingsTab.POINTS]: [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.ORG_ADMIN]
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Card elevated>
    <div role="alert" className="error-container">
      <h3>Settings Error</h3>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  </Card>
);

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <Card>
    <div role="status" aria-live="polite">
      Loading settings...
    </div>
  </Card>
);

/**
 * Enhanced settings page component with strict role-based access,
 * tenant isolation, and performance optimizations
 */
const SettingsPage: React.FC = () => {
  const { user, isAuthenticated, tenantContext } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (searchParams.get('tab') as SettingsTab) || SettingsTab.COMPANY
  );

  // Memoized permission checks for performance
  const allowedTabs = useMemo(() => {
    if (!user || !isAuthenticated) return [];
    return Object.entries(TAB_PERMISSIONS).reduce((acc, [tab, roles]) => {
      if (roles.includes(user.role)) {
        acc.push(tab as SettingsTab);
      }
      return acc;
    }, [] as SettingsTab[]);
  }, [user, isAuthenticated]);

  // Validate tenant access and permissions
  useEffect(() => {
    if (!isAuthenticated || !user || !tenantContext) {
      navigate('/login', { replace: true });
      return;
    }

    if (!allowedTabs.includes(activeTab)) {
      const firstAllowedTab = allowedTabs[0];
      if (firstAllowedTab) {
        setActiveTab(firstAllowedTab);
        setSearchParams({ tab: firstAllowedTab });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, tenantContext, activeTab, allowedTabs, navigate, setSearchParams]);

  // Handle tab changes with permission validation
  const handleTabChange = (tab: SettingsTab) => {
    if (allowedTabs.includes(tab)) {
      setActiveTab(tab);
      setSearchParams({ tab });
    }
  };

  // Audit logging for settings access
  useEffect(() => {
    if (user && activeTab) {
      console.info(`Settings access: ${activeTab} by ${user.email}`);
    }
  }, [user, activeTab]);

  if (!isAuthenticated || !user || !tenantContext) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="settings-container">
        <Card elevated>
          <nav aria-label="Settings navigation">
            <ul role="tablist">
              {allowedTabs.map((tab) => (
                <li key={tab} role="presentation">
                  <button
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-controls={`${tab}-panel`}
                    onClick={() => handleTabChange(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)} Settings
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </Card>

        <Suspense fallback={<LoadingFallback />}>
          <div
            role="tabpanel"
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
          >
            {activeTab === SettingsTab.COMPANY && (
              <CompanySettings
                companyId={tenantContext.companyId}
                isReadOnly={user.role !== Role.SUPER_ADMIN && user.role !== Role.COMPANY_ADMIN}
              />
            )}
            {activeTab === SettingsTab.ORGANIZATION && (
              <OrganizationSettings
                organizationId={tenantContext.organizationId}
                isReadOnly={user.role === Role.GENERAL_USER}
              />
            )}
            {activeTab === SettingsTab.TEAM && (
              <TeamSettings
                teamId={tenantContext.teamId}
                isReadOnly={!allowedTabs.includes(SettingsTab.TEAM)}
              />
            )}
            {activeTab === SettingsTab.POINTS && (
              <PointsSettings
                companyId={tenantContext.companyId}
                organizationId={tenantContext.organizationId}
                isReadOnly={!allowedTabs.includes(SettingsTab.POINTS)}
              />
            )}
          </div>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
};

export default SettingsPage;