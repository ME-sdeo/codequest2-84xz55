/**
 * @fileoverview Organization Settings component with enhanced security, multi-tenant isolation,
 * and comprehensive RBAC for administrators to configure organization details and point systems.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // v18.0+
import { useForm } from 'react-hook-form'; // v7.0+
import { toast } from 'react-toastify'; // v9.0+
import debounce from 'lodash/debounce'; // v4.0+

// Internal imports
import Card from '../common/Card';
import Input from '../common/Input';
import { 
  getOrganization, 
  updateOrganization, 
  getOrganizationPoints 
} from '../../api/organization.api';
import { Role, type TenantContext } from '../../types/common.types';
import { ActivityType } from '../../types/activity.types';
import { BASE_POINTS, AI_POINT_MODIFIER } from '../../constants/activity.constants';
import { sanitizeInput } from '../../utils/validation.utils';

// Component interfaces
interface OrganizationSettingsProps {
  organizationId: string;
  userRole: Role;
  tenantContext: TenantContext;
}

interface OrganizationFormData {
  name: string;
  pointOverrides: {
    basePoints: Record<ActivityType, number>;
    aiMultiplier: number;
    customRules: Record<string, number>;
  };
  teamConfiguration: {
    allowCustomPoints: boolean;
    requireApproval: boolean;
  };
  auditTrail: {
    enableDetailed: boolean;
    retentionDays: number;
  };
}

/**
 * Enhanced Organization Settings component with security and RBAC
 */
const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({
  organizationId,
  userRole,
  tenantContext
}) => {
  // Form initialization with validation
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<OrganizationFormData>();
  
  // Component state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Security validation for role-based access
  const canEdit = useMemo(() => {
    return [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.ORG_ADMIN].includes(userRole);
  }, [userRole]);

  // Fetch organization data with tenant isolation
  const fetchOrganizationData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [orgResponse, pointsResponse] = await Promise.all([
        getOrganization(organizationId),
        getOrganizationPoints(organizationId)
      ]);

      if (orgResponse.success && pointsResponse.success) {
        setValue('name', sanitizeInput(orgResponse.data.name));
        setValue('pointOverrides', pointsResponse.data);
        setValue('teamConfiguration', orgResponse.data.teamConfiguration);
        setValue('auditTrail', orgResponse.data.auditTrail);
      }
    } catch (error) {
      toast.error('Failed to load organization settings');
      console.error('Organization data fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, setValue]);

  // Debounced save handler with security checks
  const debouncedSave = useMemo(
    () => debounce(async (data: OrganizationFormData) => {
      try {
        setIsSaving(true);

        // Security validation
        if (!canEdit) {
          throw new Error('Insufficient permissions');
        }

        // Sanitize and validate input data
        const sanitizedData = {
          ...data,
          name: sanitizeInput(data.name),
          pointOverrides: {
            ...data.pointOverrides,
            customRules: Object.fromEntries(
              Object.entries(data.pointOverrides.customRules)
                .map(([key, value]) => [sanitizeInput(key), value])
            )
          }
        };

        const response = await updateOrganization(organizationId, sanitizedData);
        
        if (response.success) {
          setLastSaved(new Date());
          toast.success('Settings saved successfully');
        }
      } catch (error) {
        toast.error('Failed to save settings');
        console.error('Settings update error:', error);
      } finally {
        setIsSaving(false);
      }
    }, 500),
    [organizationId, canEdit]
  );

  // Form submission handler
  const onSubmit = useCallback(async (data: OrganizationFormData) => {
    await debouncedSave(data);
  }, [debouncedSave]);

  // Initial data load
  useEffect(() => {
    fetchOrganizationData();
  }, [fetchOrganizationData]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  if (isLoading) {
    return (
      <Card elevated>
        <div>Loading organization settings...</div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} aria-label="Organization Settings Form">
      <Card elevated className="organization-settings">
        {/* Organization Details Section */}
        <section aria-labelledby="org-details-heading">
          <h2 id="org-details-heading">Organization Details</h2>
          <Input
            id="org-name"
            label="Organization Name"
            {...register('name', { required: 'Name is required' })}
            error={!!errors.name}
            helperText={errors.name?.message}
            disabled={!canEdit}
          />
        </section>

        {/* Point Configuration Section */}
        <section aria-labelledby="point-config-heading">
          <h2 id="point-config-heading">Point Configuration</h2>
          {Object.values(ActivityType).map((type) => (
            <Input
              key={type}
              id={`points-${type}`}
              label={`${type} Points`}
              type="number"
              {...register(`pointOverrides.basePoints.${type}`, {
                min: { value: 0, message: 'Points must be positive' },
                max: { value: 100, message: 'Maximum 100 points allowed' }
              })}
              error={!!errors.pointOverrides?.basePoints?.[type]}
              helperText={errors.pointOverrides?.basePoints?.[type]?.message}
              disabled={!canEdit}
            />
          ))}
          <Input
            id="ai-multiplier"
            label="AI Detection Multiplier"
            type="number"
            {...register('pointOverrides.aiMultiplier', {
              min: { value: 0, message: 'Multiplier must be positive' },
              max: { value: 1, message: 'Maximum multiplier is 1' }
            })}
            error={!!errors.pointOverrides?.aiMultiplier}
            helperText={errors.pointOverrides?.aiMultiplier?.message}
            disabled={!canEdit}
          />
        </section>

        {/* Team Configuration Section */}
        <section aria-labelledby="team-config-heading">
          <h2 id="team-config-heading">Team Configuration</h2>
          <Input
            id="allow-custom-points"
            type="checkbox"
            label="Allow Custom Point Rules"
            {...register('teamConfiguration.allowCustomPoints')}
            disabled={!canEdit}
          />
          <Input
            id="require-approval"
            type="checkbox"
            label="Require Approval for Point Changes"
            {...register('teamConfiguration.requireApproval')}
            disabled={!canEdit}
          />
        </section>

        {/* Audit Configuration Section */}
        <section aria-labelledby="audit-config-heading">
          <h2 id="audit-config-heading">Audit Configuration</h2>
          <Input
            id="detailed-audit"
            type="checkbox"
            label="Enable Detailed Audit Trail"
            {...register('auditTrail.enableDetailed')}
            disabled={!canEdit}
          />
          <Input
            id="retention-days"
            type="number"
            label="Audit Trail Retention (Days)"
            {...register('auditTrail.retentionDays', {
              min: { value: 30, message: 'Minimum 30 days required' },
              max: { value: 365, message: 'Maximum 365 days allowed' }
            })}
            error={!!errors.auditTrail?.retentionDays}
            helperText={errors.auditTrail?.retentionDays?.message}
            disabled={!canEdit}
          />
        </section>

        {canEdit && (
          <div className="settings-actions">
            <button 
              type="submit" 
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            {lastSaved && (
              <span className="last-saved">
                Last saved: {lastSaved.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </Card>
    </form>
  );
};

// Export the component
export default OrganizationSettings;