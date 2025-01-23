/**
 * Tenant Configuration Validator
 * Version: 1.0.0
 * 
 * Provides comprehensive validation for tenant configurations including
 * subscription tiers, point systems, and AI code detection modifiers.
 */

import { z } from 'zod'; // v3.22.0
import { TenantConfig } from '../interfaces/tenant.interface';
import { DEFAULT_POINTS_CONFIG } from '../constants/points.constants';
import { ActivityType } from '../interfaces/activity.interface';

// Global validation constants
const MIN_POINTS_PER_ACTIVITY = 5;
const MAX_POINTS_PER_ACTIVITY = 100;
const MIN_AI_MODIFIER = 0.5;
const MAX_AI_MODIFIER = 1.0;
const TIER_LIMITS = {
  SMALL: 10,
  MEDIUM: 50,
  ENTERPRISE: 10000
};

/**
 * Zod schema for base point configuration
 */
const basePointsSchema = z.object({
  codeCheckIn: z.number()
    .min(MIN_POINTS_PER_ACTIVITY)
    .max(MAX_POINTS_PER_ACTIVITY),
  pullRequest: z.number()
    .min(MIN_POINTS_PER_ACTIVITY)
    .max(MAX_POINTS_PER_ACTIVITY),
  codeReview: z.number()
    .min(MIN_POINTS_PER_ACTIVITY)
    .max(MAX_POINTS_PER_ACTIVITY),
  bugFix: z.number()
    .min(MIN_POINTS_PER_ACTIVITY)
    .max(MAX_POINTS_PER_ACTIVITY),
  storyClosure: z.number()
    .min(MIN_POINTS_PER_ACTIVITY)
    .max(MAX_POINTS_PER_ACTIVITY)
}).strict();

/**
 * Zod schema for point configuration
 */
const pointConfigSchema = z.object({
  basePoints: basePointsSchema,
  aiModifier: z.number()
    .min(MIN_AI_MODIFIER)
    .max(MAX_AI_MODIFIER),
  orgOverrides: z.record(basePointsSchema).optional()
}).strict();

/**
 * Zod schema for tenant configuration
 */
export const tenantConfigSchema = z.object({
  subscriptionTier: z.enum(['SMALL', 'MEDIUM', 'ENTERPRISE']),
  pointConfig: pointConfigSchema,
  maxOrganizations: z.number().positive(),
  maxTeamsPerOrg: z.number().positive(),
  maxUsersPerTeam: z.number().positive()
}).strict();

/**
 * Validates point configuration values and modifiers
 * @param pointConfig - Point configuration to validate
 * @returns true if valid, throws ValidationError if invalid
 */
export function validatePointConfig(pointConfig: any): boolean {
  try {
    // Validate basic structure with Zod
    const validatedConfig = pointConfigSchema.parse(pointConfig);

    // Validate all activity types have points defined
    const activityTypes = Object.values(ActivityType);
    const hasAllActivityTypes = activityTypes.every(
      type => typeof validatedConfig.basePoints[type] === 'number'
    );
    if (!hasAllActivityTypes) {
      throw new Error('Missing points for some activity types');
    }

    // Validate organization overrides if present
    if (validatedConfig.orgOverrides) {
      Object.entries(validatedConfig.orgOverrides).forEach(([orgId, override]) => {
        if (!activityTypes.every(type => typeof override[type] === 'number')) {
          throw new Error(`Invalid override configuration for organization ${orgId}`);
        }
      });
    }

    // Compare against default configuration
    const defaultPoints = DEFAULT_POINTS_CONFIG.basePoints;
    const hasValidDefaults = Object.entries(defaultPoints).every(([type, points]) => {
      const configPoints = validatedConfig.basePoints[type];
      return configPoints >= MIN_POINTS_PER_ACTIVITY && 
             configPoints <= MAX_POINTS_PER_ACTIVITY;
    });
    if (!hasValidDefaults) {
      throw new Error('Point values outside allowed range');
    }

    return true;
  } catch (error) {
    throw new Error(`Point configuration validation failed: ${error.message}`);
  }
}

/**
 * Validates organization-specific point configuration overrides
 * @param overrides - Organization override configurations
 * @returns true if valid, throws ValidationError if invalid
 */
export function validateOrganizationOverrides(overrides: Record<string, any>): boolean {
  try {
    Object.entries(overrides).forEach(([orgId, config]) => {
      // Validate each override with point config schema
      const validatedOverride = basePointsSchema.parse(config);

      // Check for duplicate organization entries
      const orgIds = Object.keys(overrides);
      if (orgIds.filter(id => id === orgId).length > 1) {
        throw new Error(`Duplicate override configuration for organization ${orgId}`);
      }

      // Validate point values are within allowed ranges
      Object.values(validatedOverride).forEach(points => {
        if (points < MIN_POINTS_PER_ACTIVITY || points > MAX_POINTS_PER_ACTIVITY) {
          throw new Error(`Invalid point value in organization ${orgId} override`);
        }
      });
    });

    return true;
  } catch (error) {
    throw new Error(`Organization override validation failed: ${error.message}`);
  }
}

/**
 * Validates a tenant configuration object against defined schemas and business rules
 * @param config - Tenant configuration to validate
 * @returns true if valid, throws ValidationError if invalid
 */
export async function validateTenantConfig(config: TenantConfig): Promise<boolean> {
  try {
    // Validate basic structure with Zod schema
    const validatedConfig = tenantConfigSchema.parse(config);

    // Validate subscription tier limits
    const tierLimit = TIER_LIMITS[validatedConfig.subscriptionTier];
    if (validatedConfig.maxTeamsPerOrg > tierLimit) {
      throw new Error(`Team limit exceeds subscription tier maximum of ${tierLimit}`);
    }

    // Validate point configuration
    await validatePointConfig(validatedConfig.pointConfig);

    // Validate organization overrides if present
    if (validatedConfig.pointConfig.orgOverrides) {
      await validateOrganizationOverrides(validatedConfig.pointConfig.orgOverrides);
    }

    // Validate AI modifier ranges
    const { aiModifier } = validatedConfig.pointConfig;
    if (aiModifier < MIN_AI_MODIFIER || aiModifier > MAX_AI_MODIFIER) {
      throw new Error(`AI modifier ${aiModifier} outside allowed range`);
    }

    return true;
  } catch (error) {
    throw new Error(`Tenant configuration validation failed: ${error.message}`);
  }
}