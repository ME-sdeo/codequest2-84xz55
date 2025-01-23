/**
 * @fileoverview Enhanced React component for managing team settings with real-time updates,
 * tenant isolation, and comprehensive security features.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { TenantValidation } from '@organization/tenant-validation';

// Internal imports
import { Team } from '../../types/team.types';
import { useTeam } from '../../hooks/useTeam';
import { useWebSocket, ConnectionState } from '../../hooks/useWebSocket';

// Constants for form validation
const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 50;
const DEBOUNCE_DELAY = 500;

/**
 * Props interface for TeamSettings component with enhanced security
 */
interface TeamSettingsProps {
  teamId: string;
  organizationId: string;
  tenantId: string;
  permissions: {
    canManageTeam: boolean;
    canManageMembers: boolean;
    canConfigurePoints: boolean;
  };
}

/**
 * Interface for team form data with validation
 */
interface TeamFormData {
  name: string;
  pointConfig: {
    basePoints: Record<string, number>;
    aiModifier: number;
  };
  members: Array<{
    id: string;
    role: string;
  }>;
}

/**
 * Enhanced team settings component with security and performance optimizations
 */
const TeamSettings: React.FC<TeamSettingsProps> = ({
  teamId,
  organizationId,
  tenantId,
  permissions
}) => {
  // State management with proper typing
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    pointConfig: {
      basePoints: {},
      aiModifier: 0.75
    },
    members: []
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Custom hooks with tenant isolation
  const {
    currentTeam,
    updateTeam,
    addMember,
    removeMember,
    updatePointConfig,
    error: teamError
  } = useTeam({
    teamId,
    tenantId
  });

  const {
    isConnected: wsConnected,
    subscribe,
    unsubscribe,
    connectionState
  } = useWebSocket();

  // Memoized validation function
  const validateForm = useMemo(() => {
    return (data: TeamFormData): Record<string, string> => {
      const newErrors: Record<string, string> = {};

      if (!data.name || data.name.length < NAME_MIN_LENGTH) {
        newErrors.name = `Team name must be at least ${NAME_MIN_LENGTH} characters`;
      }
      if (data.name.length > NAME_MAX_LENGTH) {
        newErrors.name = `Team name cannot exceed ${NAME_MAX_LENGTH} characters`;
      }

      if (data.pointConfig.aiModifier < 0 || data.pointConfig.aiModifier > 1) {
        newErrors.aiModifier = 'AI modifier must be between 0 and 1';
      }

      return newErrors;
    };
  }, []);

  // Initialize form data from current team
  useEffect(() => {
    if (currentTeam) {
      setFormData({
        name: currentTeam.name,
        pointConfig: currentTeam.pointConfig,
        members: currentTeam.members || []
      });
    }
  }, [currentTeam]);

  // Set up WebSocket subscriptions for real-time updates
  useEffect(() => {
    if (wsConnected) {
      const handleTeamUpdate = (update: Partial<Team>) => {
        if (update.id === teamId) {
          setFormData(prev => ({ ...prev, ...update }));
        }
      };

      subscribe(`team:${teamId}:update`, handleTeamUpdate);
      return () => unsubscribe(`team:${teamId}:update`, handleTeamUpdate);
    }
  }, [wsConnected, teamId, subscribe, unsubscribe]);

  // Handle form submission with validation and security checks
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await updateTeam(teamId, {
        name: formData.name,
        pointConfig: formData.pointConfig
      });
      setIsDirty(false);
      setErrors({});
    } catch (error) {
      setErrors({
        submit: 'Failed to update team settings'
      });
    }
  }, [teamId, formData, updateTeam, validateForm]);

  // Handle member management with security checks
  const handleAddMember = useCallback(async (userId: string) => {
    if (!permissions.canManageMembers) return;

    try {
      await addMember(teamId, userId);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        members: 'Failed to add team member'
      }));
    }
  }, [teamId, permissions.canManageMembers, addMember]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!permissions.canManageMembers) return;

    try {
      await removeMember(teamId, userId);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        members: 'Failed to remove team member'
      }));
    }
  }, [teamId, permissions.canManageMembers, removeMember]);

  // Handle point configuration updates with validation
  const handlePointConfigUpdate = useCallback(async (config: typeof formData.pointConfig) => {
    if (!permissions.canConfigurePoints) return;

    try {
      await updatePointConfig(teamId, config);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        pointConfig: 'Failed to update point configuration'
      }));
    }
  }, [teamId, permissions.canConfigurePoints, updatePointConfig]);

  // Render loading state
  if (!currentTeam) {
    return <div aria-live="polite">Loading team settings...</div>;
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div role="alert" className="error-boundary">
          <h2>Error Loading Team Settings</h2>
          <pre>{error.message}</pre>
        </div>
      )}
    >
      <TenantValidation tenantId={tenantId}>
        <div className="team-settings" role="main">
          <header>
            <h1>Team Settings</h1>
            {wsConnected && (
              <span className="real-time-indicator" aria-label="Real-time updates active">
                ●
              </span>
            )}
          </header>

          <form onSubmit={handleSubmit} aria-label="Team settings form">
            {/* Team Name Section */}
            <section aria-labelledby="team-name-heading">
              <h2 id="team-name-heading">Team Name</h2>
              <input
                type="text"
                id="team-name"
                value={formData.name}
                onChange={e => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  setIsDirty(true);
                }}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                disabled={!permissions.canManageTeam}
              />
              {errors.name && (
                <span id="name-error" className="error" role="alert">
                  {errors.name}
                </span>
              )}
            </section>

            {/* Point Configuration Section */}
            {permissions.canConfigurePoints && (
              <section aria-labelledby="point-config-heading">
                <h2 id="point-config-heading">Point Configuration</h2>
                <div className="point-config-form">
                  <label htmlFor="ai-modifier">AI Code Modifier</label>
                  <input
                    type="number"
                    id="ai-modifier"
                    min="0"
                    max="1"
                    step="0.05"
                    value={formData.pointConfig.aiModifier}
                    onChange={e => {
                      setFormData(prev => ({
                        ...prev,
                        pointConfig: {
                          ...prev.pointConfig,
                          aiModifier: parseFloat(e.target.value)
                        }
                      }));
                      setIsDirty(true);
                    }}
                    aria-invalid={!!errors.aiModifier}
                  />
                </div>
              </section>
            )}

            {/* Team Members Section */}
            {permissions.canManageMembers && (
              <section aria-labelledby="members-heading">
                <h2 id="members-heading">Team Members</h2>
                <ul className="member-list" role="list">
                  {formData.members.map(member => (
                    <li key={member.id}>
                      <span>{member.id}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        aria-label={`Remove ${member.id} from team`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Form Actions */}
            <div className="form-actions">
              <button
                type="submit"
                disabled={!isDirty || Object.keys(errors).length > 0}
                aria-busy={connectionState === ConnectionState.CONNECTING}
              >
                Save Changes
              </button>
            </div>

            {/* Error Summary */}
            {(teamError || errors.submit) && (
              <div className="error-summary" role="alert" aria-live="polite">
                {teamError || errors.submit}
              </div>
            )}
          </form>
        </div>
      </TenantValidation>
    </ErrorBoundary>
  );
};

export default TeamSettings;