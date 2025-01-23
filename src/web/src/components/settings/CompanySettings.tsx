import React, { useState, useEffect, useCallback, useRef } from 'react'; // react v18.0+
import { useForm } from 'react-hook-form'; // react-hook-form v7.0+
import { zodResolver } from '@hookform/resolvers/zod'; // @hookform/resolvers/zod v2.0+
import { z } from 'zod'; // zod v3.0+
import { ErrorBoundary } from 'react-error-boundary'; // react-error-boundary v4.0+
import { useRBAC } from '@auth/rbac'; // @auth/rbac v1.0+
import Card from '../common/Card';

// Zod schema for form validation
const companySettingsSchema = z.object({
  name: z.string()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name cannot exceed 100 characters'),
  subscriptionTier: z.enum(['SMALL', 'MEDIUM', 'ENTERPRISE']),
  pointConfig: z.object({
    codeCheckin: z.number().min(0).max(100),
    pullRequest: z.number().min(0).max(100),
    codeReview: z.number().min(0).max(100),
    bugFix: z.number().min(0).max(100),
    storyClose: z.number().min(0).max(100),
    aiModifier: z.number().min(0).max(1).default(0.75),
  }),
  securitySettings: z.object({
    enforceSSO: z.boolean(),
    mfaRequired: z.boolean(),
    sessionTimeout: z.number().min(5).max(1440),
    ipRestrictions: z.array(z.string().ip()).optional(),
  }),
  auditConfig: z.object({
    enableAuditLog: z.boolean(),
    retentionDays: z.number().min(30).max(1095),
    logLevel: z.enum(['BASIC', 'DETAILED', 'DEBUG']),
  }),
});

// Types derived from schema
type CompanyFormData = z.infer<typeof companySettingsSchema>;

interface CompanySettingsProps {
  companyId: string;
  isReadOnly?: boolean;
  onSettingsUpdate?: (settings: CompanyFormData) => Promise<void>;
}

// Custom hook for company settings management
const useCompanySettings = (companyId: string) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController>();

  const fetchSettings = useCallback(async () => {
    try {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const response = await fetch(`/api/v1/companies/${companyId}/settings`, {
        signal: abortControllerRef.current.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch company settings');
      }

      return await response.json();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchSettings();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchSettings]);

  return { loading, error, fetchSettings };
};

// Error Fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => (
  <Card elevated>
    <div role="alert">
      <h3>Something went wrong:</h3>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  </Card>
);

const CompanySettings: React.FC<CompanySettingsProps> = ({
  companyId,
  isReadOnly = false,
  onSettingsUpdate,
}) => {
  const { hasPermission } = useRBAC();
  const { loading, error, fetchSettings } = useCompanySettings(companyId);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySettingsSchema),
    mode: 'onChange',
  });

  const canEdit = hasPermission('COMPANY_SETTINGS_EDIT') && !isReadOnly;

  const onSubmit = async (data: CompanyFormData) => {
    if (!canEdit || saving) return;

    try {
      setSaving(true);
      
      // CSRF token validation
      const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
      if (!csrfToken) throw new Error('CSRF token not found');

      const response = await fetch(`/api/v1/companies/${companyId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update company settings');
      }

      await onSettingsUpdate?.(data);
      reset(data);
    } catch (err) {
      console.error('Error updating company settings:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div aria-label="Loading company settings">Loading...</div>
      </Card>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={fetchSettings}>
      <form onSubmit={handleSubmit(onSubmit)} aria-label="Company Settings Form">
        <Card elevated>
          <h2>Company Settings</h2>
          
          {/* Company Information */}
          <section aria-labelledby="company-info-heading">
            <h3 id="company-info-heading">Company Information</h3>
            <div>
              <label htmlFor="name">Company Name</label>
              <input
                id="name"
                type="text"
                {...register('name')}
                disabled={!canEdit}
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <span role="alert">{errors.name.message}</span>
              )}
            </div>

            <div>
              <label htmlFor="subscriptionTier">Subscription Tier</label>
              <select
                id="subscriptionTier"
                {...register('subscriptionTier')}
                disabled={!canEdit}
                aria-invalid={!!errors.subscriptionTier}
              >
                <option value="SMALL">Small (1 Org, 10 Teams)</option>
                <option value="MEDIUM">Medium (5 Orgs, 50 Teams)</option>
                <option value="ENTERPRISE">Enterprise (100 Orgs, 10,000 Teams)</option>
              </select>
            </div>
          </section>

          {/* Point Configuration */}
          <section aria-labelledby="point-config-heading">
            <h3 id="point-config-heading">Point Configuration</h3>
            {Object.entries({
              codeCheckin: 'Code Check-in',
              pullRequest: 'Pull Request',
              codeReview: 'Code Review',
              bugFix: 'Bug Fix',
              storyClose: 'Story Closure',
            }).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`pointConfig.${key}`}>{label}</label>
                <input
                  id={`pointConfig.${key}`}
                  type="number"
                  {...register(`pointConfig.${key as keyof CompanyFormData['pointConfig']}`, {
                    valueAsNumber: true,
                  })}
                  disabled={!canEdit}
                  min={0}
                  max={100}
                />
              </div>
            ))}
            
            <div>
              <label htmlFor="pointConfig.aiModifier">AI Code Modifier</label>
              <input
                id="pointConfig.aiModifier"
                type="number"
                {...register('pointConfig.aiModifier', {
                  valueAsNumber: true,
                })}
                disabled={!canEdit}
                step={0.05}
                min={0}
                max={1}
              />
            </div>
          </section>

          {/* Security Settings */}
          <section aria-labelledby="security-settings-heading">
            <h3 id="security-settings-heading">Security Settings</h3>
            <div>
              <label htmlFor="securitySettings.enforceSSO">
                <input
                  id="securitySettings.enforceSSO"
                  type="checkbox"
                  {...register('securitySettings.enforceSSO')}
                  disabled={!canEdit}
                />
                Enforce SSO
              </label>
            </div>

            <div>
              <label htmlFor="securitySettings.mfaRequired">
                <input
                  id="securitySettings.mfaRequired"
                  type="checkbox"
                  {...register('securitySettings.mfaRequired')}
                  disabled={!canEdit}
                />
                Require MFA
              </label>
            </div>

            <div>
              <label htmlFor="securitySettings.sessionTimeout">
                Session Timeout (minutes)
              </label>
              <input
                id="securitySettings.sessionTimeout"
                type="number"
                {...register('securitySettings.sessionTimeout', {
                  valueAsNumber: true,
                })}
                disabled={!canEdit}
                min={5}
                max={1440}
              />
            </div>
          </section>

          {/* Audit Configuration */}
          <section aria-labelledby="audit-config-heading">
            <h3 id="audit-config-heading">Audit Configuration</h3>
            <div>
              <label htmlFor="auditConfig.enableAuditLog">
                <input
                  id="auditConfig.enableAuditLog"
                  type="checkbox"
                  {...register('auditConfig.enableAuditLog')}
                  disabled={!canEdit}
                />
                Enable Audit Logging
              </label>
            </div>

            <div>
              <label htmlFor="auditConfig.retentionDays">
                Log Retention (days)
              </label>
              <input
                id="auditConfig.retentionDays"
                type="number"
                {...register('auditConfig.retentionDays', {
                  valueAsNumber: true,
                })}
                disabled={!canEdit}
                min={30}
                max={1095}
              />
            </div>

            <div>
              <label htmlFor="auditConfig.logLevel">Log Level</label>
              <select
                id="auditConfig.logLevel"
                {...register('auditConfig.logLevel')}
                disabled={!canEdit}
              >
                <option value="BASIC">Basic</option>
                <option value="DETAILED">Detailed</option>
                <option value="DEBUG">Debug</option>
              </select>
            </div>
          </section>

          {canEdit && (
            <div>
              <button
                type="submit"
                disabled={saving || !isDirty}
                aria-busy={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </Card>
      </form>
    </ErrorBoundary>
  );
};

export default CompanySettings;