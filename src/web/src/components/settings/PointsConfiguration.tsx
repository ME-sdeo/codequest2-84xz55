import React, { useEffect, useState, useCallback, memo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { withErrorBoundary } from 'react-error-boundary';

// Internal imports
import { PointsConfig } from '../../types/points.types';
import { pointsService } from '../../services/points.service';
import { ActivityType } from '../../types/activity.types';
import { DEFAULT_POINTS_CONFIG, POINTS_VALIDATION } from '../../constants/points.constants';

// Component props interface
interface PointsConfigurationProps {
  organizationId: string;
  isAdmin: boolean;
  onConfigChange?: (config: PointsConfig) => void;
  enableAudit?: boolean;
}

// Form values interface
interface FormValues extends PointsConfig {
  enableRealTimePreview: boolean;
}

/**
 * Enhanced points configuration component with real-time validation and preview
 */
const PointsConfiguration: React.FC<PointsConfigurationProps> = memo(({
  organizationId,
  isAdmin,
  onConfigChange,
  enableAudit = true
}) => {
  // State management
  const [loading, setLoading] = useState(true);
  const [previewPoints, setPreviewPoints] = useState<Record<ActivityType, number>>({});

  // Form initialization with validation
  const { control, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<FormValues>({
    defaultValues: {
      ...DEFAULT_POINTS_CONFIG,
      configVersion: 1,
      enableRealTimePreview: true
    }
  });

  // Watch form values for real-time preview
  const formValues = watch();
  const enablePreview = watch('enableRealTimePreview');

  /**
   * Load current configuration from the server
   */
  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const config = await pointsService.getPointsConfiguration();
      if (config) {
        Object.entries(config).forEach(([key, value]) => {
          setValue(key as keyof FormValues, value);
        });
      }
    } catch (error) {
      toast.error('Failed to load points configuration');
      console.error('Configuration load error:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update point configuration with validation and error handling
   */
  const onSubmit = async (data: FormValues) => {
    try {
      // Validate configuration
      const validationResult = await pointsService.validateConfiguration(data);
      if (!validationResult.success) {
        toast.error(validationResult.error);
        return;
      }

      // Update configuration
      const response = await pointsService.updatePointsConfiguration({
        ...data,
        organizationId,
        configVersion: data.configVersion + 1
      });

      if (response.success) {
        toast.success('Points configuration updated successfully');
        onConfigChange?.(response.data);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      toast.error('Failed to update points configuration');
      console.error('Configuration update error:', error);
    }
  };

  /**
   * Preview point calculations with AI detection
   */
  const updatePointPreview = useCallback(
    debounce(async (values: FormValues) => {
      if (!enablePreview) return;

      try {
        const preview = await pointsService.previewAIModifiedPoints(values);
        setPreviewPoints(preview);
      } catch (error) {
        console.error('Preview calculation error:', error);
      }
    }, 500),
    [enablePreview]
  );

  // Effect for loading initial configuration
  useEffect(() => {
    loadConfiguration();
  }, [organizationId]);

  // Effect for updating preview calculations
  useEffect(() => {
    if (isDirty) {
      updatePointPreview(formValues);
    }
  }, [formValues, isDirty, updatePointPreview]);

  if (loading) {
    return <div>Loading configuration...</div>;
  }

  return (
    <div className="points-configuration">
      <h2>Points Configuration</h2>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Base Points Configuration */}
        <section className="base-points">
          <h3>Activity Point Values</h3>
          {Object.values(ActivityType).map((activity) => (
            <div key={activity} className="point-input-group">
              <Controller
                name={`basePoints.${activity}`}
                control={control}
                rules={{
                  required: true,
                  min: POINTS_VALIDATION.MIN_POINTS,
                  max: POINTS_VALIDATION.MAX_POINTS
                }}
                render={({ field }) => (
                  <div>
                    <label htmlFor={field.name}>{activity}</label>
                    <input
                      {...field}
                      type="number"
                      id={field.name}
                      disabled={!isAdmin}
                    />
                    {enablePreview && (
                      <span className="preview">
                        AI Modified: {previewPoints[activity] || '-'}
                      </span>
                    )}
                    {errors.basePoints?.[activity] && (
                      <span className="error">Invalid point value</span>
                    )}
                  </div>
                )}
              />
            </div>
          ))}
        </section>

        {/* AI Modifier Configuration */}
        <section className="ai-modifier">
          <h3>AI Detection Modifier</h3>
          <Controller
            name="aiModifier"
            control={control}
            rules={{
              required: true,
              min: 0,
              max: 1
            }}
            render={({ field }) => (
              <div>
                <label htmlFor="aiModifier">AI Code Modifier (0-1)</label>
                <input
                  {...field}
                  type="number"
                  step="0.05"
                  id="aiModifier"
                  disabled={!isAdmin}
                />
                {errors.aiModifier && (
                  <span className="error">Invalid modifier value</span>
                )}
              </div>
            )}
          />
        </section>

        {/* Preview Toggle */}
        <section className="preview-toggle">
          <Controller
            name="enableRealTimePreview"
            control={control}
            render={({ field }) => (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                  Enable Real-time Preview
                </label>
              </div>
            )}
          />
        </section>

        {/* Submit Button */}
        {isAdmin && (
          <div className="actions">
            <button
              type="submit"
              disabled={!isDirty}
              className="submit-button"
            >
              Save Configuration
            </button>
          </div>
        )}
      </form>
    </div>
  );
});

// Error boundary wrapper
const PointsConfigurationWithErrorBoundary = withErrorBoundary(PointsConfiguration, {
  fallback: <div>Error loading points configuration</div>,
  onError: (error) => {
    console.error('Points configuration error:', error);
    toast.error('An error occurred in the points configuration');
  }
});

// Export with display name for debugging
PointsConfigurationWithErrorBoundary.displayName = 'PointsConfiguration';

export default PointsConfigurationWithErrorBoundary;