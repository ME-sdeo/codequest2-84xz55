/**
 * @fileoverview Points calculation and level progression utility functions
 * Implements core gamification logic with multi-tenant support and performance optimization
 * @version 1.0.0
 */

import { clamp, memoize } from 'lodash'; // v4.17.21
import { ActivityType } from '@types/activity-types'; // v1.0.0
import winston from 'winston'; // v3.8.0

import { IPointsConfig } from '../interfaces/points.interface';
import { TenantContext } from '../interfaces/tenant.interface';
import { DEFAULT_POINTS_CONFIG, LEVEL_THRESHOLDS } from '../constants/points.constants';

// Global constants for point calculation boundaries
const MIN_POINTS_PER_ACTIVITY = 5;
const MAX_POINTS_PER_ACTIVITY = 100;
const CACHE_TTL_MS = 60000; // 1 minute cache TTL
const MAX_CACHE_SIZE = 1000;

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Interface for level progression tracking
 */
interface ILevelProgress {
  currentLevel: number;
  totalPoints: number;
  nextLevelThreshold: number;
  progressPercentage: number;
}

/**
 * Calculates points for an activity with tenant-specific configuration
 * Implements point calculation rules from A.1.1 with performance optimization
 * 
 * @param activityType - Type of activity performed
 * @param isAiGenerated - Whether the activity contains AI-generated code
 * @param config - Tenant-specific points configuration
 * @param tenantContext - Tenant context for validation
 * @returns Calculated points value
 */
export const calculatePoints = memoize(async (
  activityType: ActivityType,
  isAiGenerated: boolean,
  config: IPointsConfig,
  tenantContext: TenantContext
): Promise<number> => {
  try {
    // Validate tenant context
    if (!tenantContext.validateTenant()) {
      throw new Error('Invalid tenant context');
    }

    // Get base points from config or default
    const basePoints = config.basePoints[activityType] || 
                      DEFAULT_POINTS_CONFIG.basePoints[activityType];

    // Apply AI modifier if applicable
    const aiModifier = isAiGenerated ? config.aiModifier : 1;
    
    // Calculate final points with modifiers
    const calculatedPoints = Math.floor(basePoints * aiModifier);

    // Clamp points within allowed range
    const finalPoints = clamp(
      calculatedPoints,
      MIN_POINTS_PER_ACTIVITY,
      MAX_POINTS_PER_ACTIVITY
    );

    logger.debug('Points calculated', {
      activityType,
      basePoints,
      aiModifier,
      finalPoints,
      tenantId: tenantContext.tenantId
    });

    return finalPoints;
  } catch (error) {
    logger.error('Error calculating points', {
      error,
      activityType,
      tenantId: tenantContext.tenantId
    });
    throw error;
  }
}, (activityType, isAiGenerated, config, tenantContext) => 
  `${tenantContext.tenantId}:${activityType}:${isAiGenerated}`
);

/**
 * Calculates user's current level and progress
 * Implements level progression system with optimized lookup
 * 
 * @param totalPoints - Total points accumulated by user
 * @param tenantContext - Tenant context for validation
 * @returns Level progress details
 */
export const calculateLevelProgress = memoize(async (
  totalPoints: number,
  tenantContext: TenantContext
): Promise<ILevelProgress> => {
  try {
    // Validate tenant context
    if (!tenantContext.validateTenant()) {
      throw new Error('Invalid tenant context');
    }

    // Find current level using binary search
    const levels = Array.from(LEVEL_THRESHOLDS.entries());
    let currentLevel = 1;
    let nextThreshold = LEVEL_THRESHOLDS.get(2) || 0;

    for (const [level, threshold] of levels) {
      if (totalPoints >= threshold) {
        currentLevel = level;
        nextThreshold = LEVEL_THRESHOLDS.get(level + 1) || threshold;
      } else {
        break;
      }
    }

    // Calculate progress percentage to next level
    const currentThreshold = LEVEL_THRESHOLDS.get(currentLevel) || 0;
    const progressPoints = totalPoints - currentThreshold;
    const pointsToNextLevel = nextThreshold - currentThreshold;
    const progressPercentage = Math.min(
      (progressPoints / pointsToNextLevel) * 100,
      100
    );

    const progress: ILevelProgress = {
      currentLevel,
      totalPoints,
      nextLevelThreshold: nextThreshold,
      progressPercentage
    };

    logger.debug('Level progress calculated', {
      ...progress,
      tenantId: tenantContext.tenantId
    });

    return progress;
  } catch (error) {
    logger.error('Error calculating level progress', {
      error,
      totalPoints,
      tenantId: tenantContext.tenantId
    });
    throw error;
  }
}, (totalPoints, tenantContext) => 
  `${tenantContext.tenantId}:${totalPoints}`
);

/**
 * Validates points configuration for tenant
 * Implements configuration validation with tenant isolation
 * 
 * @param config - Points configuration to validate
 * @param tenantContext - Tenant context for validation
 * @returns Boolean indicating if configuration is valid
 */
export const validatePointsConfig = memoize(async (
  config: IPointsConfig,
  tenantContext: TenantContext
): Promise<boolean> => {
  try {
    // Validate tenant context
    if (!tenantContext.validateTenant()) {
      throw new Error('Invalid tenant context');
    }

    // Validate base points for all activity types
    const hasAllActivityTypes = Object.values(ActivityType).every(
      type => typeof config.basePoints[type] === 'number'
    );

    // Validate point values are within range
    const validPointValues = Object.values(config.basePoints).every(
      points => points >= MIN_POINTS_PER_ACTIVITY && 
               points <= MAX_POINTS_PER_ACTIVITY
    );

    // Validate AI modifier
    const validAiModifier = config.aiModifier >= 0 && config.aiModifier <= 1;

    const isValid = hasAllActivityTypes && validPointValues && validAiModifier;

    logger.debug('Points configuration validated', {
      isValid,
      tenantId: tenantContext.tenantId
    });

    return isValid;
  } catch (error) {
    logger.error('Error validating points configuration', {
      error,
      tenantId: tenantContext.tenantId
    });
    throw error;
  }
}, (config, tenantContext) => 
  `${tenantContext.tenantId}:${JSON.stringify(config)}`
);

// Configure memoization cache limits
calculatePoints.cache = new Map();
calculateLevelProgress.cache = new Map();
validatePointsConfig.cache = new Map();

// Cleanup expired cache entries periodically
setInterval(() => {
  [calculatePoints, calculateLevelProgress, validatePointsConfig].forEach(fn => {
    if (fn.cache.size > MAX_CACHE_SIZE) {
      fn.cache.clear();
    }
  });
}, CACHE_TTL_MS);