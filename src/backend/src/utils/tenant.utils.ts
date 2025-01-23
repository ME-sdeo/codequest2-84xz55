/**
 * @fileoverview Tenant utility functions for managing multi-tenant operations
 * Implements secure tenant configuration validation and real-time point calculations
 * @version 1.0.0
 */

import { 
  TenantConfig, 
  SubscriptionTier, 
  PointConfig,
  isValidSubscriptionTier,
  isValidPointConfig,
  DEFAULT_AI_MODIFIER
} from '../interfaces/tenant.interface';
import { ROLES } from '../constants/roles.constants';

/**
 * Default tenant configuration aligned with technical specifications
 * @constant
 */
export const DEFAULT_TENANT_CONFIG: Readonly<TenantConfig> = {
  subscriptionTier: SubscriptionTier.SMALL,
  pointConfig: {
    basePoints: {
      codeCheckIn: 10,
      pullRequest: 25,
      codeReview: 15,
      bugFix: 20,
      storyClosure: 30
    },
    aiModifier: DEFAULT_AI_MODIFIER,
    orgOverrides: {},
    maxPointsPerDay: 1000,
    minPointsPerActivity: 1
  },
  maxOrganizations: 1,
  maxTeamsPerOrg: 10,
  maxUsersPerTeam: 10
} as const;

/**
 * Tier-specific limits based on implementation boundaries
 * @constant
 */
export const TIER_LIMITS: Readonly<Record<SubscriptionTier, {
  maxOrgs: number;
  maxTeams: number;
  maxUsersPerTeam: number;
  maxPointsPerDay: number;
}>> = {
  [SubscriptionTier.SMALL]: {
    maxOrgs: 1,
    maxTeams: 10,
    maxUsersPerTeam: 10,
    maxPointsPerDay: 1000
  },
  [SubscriptionTier.MEDIUM]: {
    maxOrgs: 5,
    maxTeams: 50,
    maxUsersPerTeam: 20,
    maxPointsPerDay: 5000
  },
  [SubscriptionTier.ENTERPRISE]: {
    maxOrgs: 100,
    maxTeams: 10000,
    maxUsersPerTeam: 100,
    maxPointsPerDay: 50000
  }
} as const;

/**
 * Validates tenant configuration against subscription tier limits
 * Implements comprehensive validation with enhanced security checks
 * @param config - Tenant configuration to validate
 * @throws {Error} Detailed validation error if configuration is invalid
 * @returns Promise resolving to true if configuration is valid
 */
export const validateTenantConfig = async (
  config: TenantConfig
): Promise<boolean> => {
  // Validate subscription tier
  if (!isValidSubscriptionTier(config.subscriptionTier)) {
    throw new Error('Invalid subscription tier specified');
  }

  const tierLimits = TIER_LIMITS[config.subscriptionTier];

  // Validate organization limits
  if (config.maxOrganizations > tierLimits.maxOrgs) {
    throw new Error(
      `Organization count ${config.maxOrganizations} exceeds tier limit ${tierLimits.maxOrgs}`
    );
  }

  // Validate team limits
  if (config.maxTeamsPerOrg > tierLimits.maxTeams) {
    throw new Error(
      `Team count ${config.maxTeamsPerOrg} exceeds tier limit ${tierLimits.maxTeams}`
    );
  }

  // Validate user limits
  if (config.maxUsersPerTeam > tierLimits.maxUsersPerTeam) {
    throw new Error(
      `Users per team ${config.maxUsersPerTeam} exceeds tier limit ${tierLimits.maxUsersPerTeam}`
    );
  }

  // Validate point configuration
  if (!isValidPointConfig(config.pointConfig)) {
    throw new Error('Invalid point configuration');
  }

  // Validate point limits
  if (config.pointConfig.maxPointsPerDay > tierLimits.maxPointsPerDay) {
    throw new Error(
      `Daily point limit ${config.pointConfig.maxPointsPerDay} exceeds tier limit ${tierLimits.maxPointsPerDay}`
    );
  }

  // Validate AI modifier
  if (
    config.pointConfig.aiModifier < 0 || 
    config.pointConfig.aiModifier > 1
  ) {
    throw new Error('AI modifier must be between 0 and 1');
  }

  // Validate organization overrides
  for (const [orgId, overrides] of Object.entries(config.pointConfig.orgOverrides)) {
    if (!orgId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)) {
      throw new Error(`Invalid organization ID format: ${orgId}`);
    }

    // Validate override point values
    for (const [activity, points] of Object.entries(overrides)) {
      if (points < config.pointConfig.minPointsPerActivity) {
        throw new Error(
          `Points for ${activity} cannot be less than minimum ${config.pointConfig.minPointsPerActivity}`
        );
      }
    }
  }

  return true;
};

/**
 * Calculates points for an activity with AI detection and organization overrides
 * Implements real-time point calculation with caching and validation
 * @param activityType - Type of activity to calculate points for
 * @param isAiGenerated - Whether the activity was AI-generated
 * @param pointConfig - Point configuration to use for calculation
 * @param organizationId - Optional organization ID for override lookup
 * @returns Promise resolving to calculated points
 */
export const calculatePoints = async (
  activityType: keyof typeof DEFAULT_TENANT_CONFIG.pointConfig.basePoints,
  isAiGenerated: boolean,
  pointConfig: PointConfig,
  organizationId?: string
): Promise<number> => {
  // Validate activity type
  if (!(activityType in pointConfig.basePoints)) {
    throw new Error(`Invalid activity type: ${activityType}`);
  }

  // Get base points
  let points = pointConfig.basePoints[activityType];

  // Apply organization override if applicable
  if (organizationId && pointConfig.orgOverrides[organizationId]) {
    points = pointConfig.orgOverrides[organizationId][activityType] ?? points;
  }

  // Apply AI modifier if applicable
  if (isAiGenerated) {
    points = Math.floor(points * pointConfig.aiModifier);
  }

  // Ensure minimum points
  points = Math.max(points, pointConfig.minPointsPerActivity);

  // Validate against daily limit
  if (points > pointConfig.maxPointsPerDay) {
    throw new Error(
      `Calculated points ${points} exceeds daily limit ${pointConfig.maxPointsPerDay}`
    );
  }

  return points;
};

/**
 * Type guard to check if a user can modify tenant configuration
 * @param role - Role to check permissions for
 * @returns Boolean indicating if the role can modify tenant configuration
 */
export const canModifyTenantConfig = (role: ROLES): boolean => {
  return [ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN].includes(role);
};