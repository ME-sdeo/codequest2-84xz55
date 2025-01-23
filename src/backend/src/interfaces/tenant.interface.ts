/**
 * @fileoverview Core tenant interfaces for CodeQuest's multi-tenant functionality
 * Implements strict type safety and validation for tenant configuration, subscription tiers,
 * and point system settings
 * @version 1.0.0
 */

import { ROLES } from '../constants/roles.constants';

/**
 * Subscription tier levels with const assertion for type safety
 * Aligned with system tiers from technical specification
 */
export const enum SubscriptionTier {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  ENTERPRISE = 'ENTERPRISE'
}

/**
 * Default AI modifier for point calculations
 * As specified in technical requirements A.1.1
 */
export const DEFAULT_AI_MODIFIER = 0.75 as const;

/**
 * Frozen object defining tier-specific limits
 * Based on Implementation Boundaries specification
 */
export const TIER_LIMITS = Object.freeze({
  [SubscriptionTier.SMALL]: { maxOrgs: 1, maxTeams: 10, maxUsers: 100 },
  [SubscriptionTier.MEDIUM]: { maxOrgs: 5, maxTeams: 50, maxUsers: 500 },
  [SubscriptionTier.ENTERPRISE]: { maxOrgs: 100, maxTeams: 10000, maxUsers: 100000 }
});

/**
 * Base point values interface with strict readonly properties
 * Based on Point Calculation Rules from A.1.1
 */
export interface BasePoints {
  readonly codeCheckIn: number;
  readonly pullRequest: number;
  readonly codeReview: number;
  readonly bugFix: number;
  readonly storyClosure: number;
}

/**
 * Point configuration interface with immutable properties
 * Supports organization-level overrides and AI detection modifiers
 */
export interface PointConfig {
  readonly basePoints: BasePoints;
  readonly aiModifier: number;
  readonly orgOverrides: Readonly<Record<string, BasePoints>>;
}

/**
 * Core tenant configuration interface with strict validation
 * Implements multi-tenant architecture requirements
 */
export interface TenantConfig {
  readonly subscriptionTier: SubscriptionTier;
  readonly pointConfig: PointConfig;
  readonly maxOrganizations: number;
  readonly maxTeamsPerOrg: number;
  readonly maxUsersPerTeam: number;
}

/**
 * Type guard to validate subscription tier
 * @param tier - Value to check if it's a valid subscription tier
 */
export const isValidSubscriptionTier = (tier: string): tier is SubscriptionTier => {
  return Object.values(SubscriptionTier).includes(tier as SubscriptionTier);
};

/**
 * Type guard to validate point configuration
 * @param config - Configuration object to validate
 */
export const isValidPointConfig = (config: Partial<PointConfig>): config is PointConfig => {
  if (!config.basePoints || !config.aiModifier) return false;
  
  const hasValidBasePoints = (points: Partial<BasePoints>): points is BasePoints => {
    return typeof points.codeCheckIn === 'number' &&
           typeof points.pullRequest === 'number' &&
           typeof points.codeReview === 'number' &&
           typeof points.bugFix === 'number' &&
           typeof points.storyClosure === 'number';
  };

  if (!hasValidBasePoints(config.basePoints)) return false;
  
  if (config.orgOverrides) {
    return Object.values(config.orgOverrides).every(hasValidBasePoints);
  }
  
  return true;
};

/**
 * Type guard to validate tenant configuration
 * @param config - Configuration object to validate
 */
export const isValidTenantConfig = (config: Partial<TenantConfig>): config is TenantConfig => {
  if (!config.subscriptionTier || !isValidSubscriptionTier(config.subscriptionTier)) {
    return false;
  }

  const tierLimits = TIER_LIMITS[config.subscriptionTier];
  
  return typeof config.maxOrganizations === 'number' &&
         config.maxOrganizations <= tierLimits.maxOrgs &&
         typeof config.maxTeamsPerOrg === 'number' &&
         config.maxTeamsPerOrg <= tierLimits.maxTeams &&
         typeof config.maxUsersPerTeam === 'number' &&
         config.maxUsersPerTeam <= tierLimits.maxUsers &&
         isValidPointConfig(config.pointConfig);
};

/**
 * Helper function to check if a role can modify tenant configuration
 * @param role - Role to check permissions for
 */
export const canModifyTenantConfig = (role: ROLES): boolean => {
  return [ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN].includes(role);
};