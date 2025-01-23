/**
 * Points Validator Implementation
 * Version: 1.0.0
 * 
 * Provides comprehensive validation for points-related operations including
 * point awards, calculations, tenant-specific configurations, and AI detection modifiers
 */

import { Injectable, ValidatorConstraint, ValidateAll } from 'class-validator';
import { Transform, TransformationType } from 'class-transformer';
import { IPointsConfig } from '../interfaces/points.interface';
import { ActivityType, ACTIVITY_BASE_POINTS } from '../interfaces/activity.interface';
import { DEFAULT_POINTS_CONFIG, MIN_POINTS_PER_ACTIVITY, MAX_POINTS_PER_ACTIVITY } from '../constants/points.constants';
import { TenantConfig, isValidPointConfig } from '../interfaces/tenant.interface';

/**
 * Interface for validation rules with tenant context
 */
interface ValidationRule {
  validate: (value: number, tenantId: string) => boolean;
  message: string;
}

/**
 * Interface for validation configuration
 */
interface IValidationConfig {
  minPoints: number;
  maxPoints: number;
  aiModifierPrecision: number;
}

/**
 * Points Configuration Validator Class
 * Implements comprehensive validation for points system configuration
 */
@Injectable()
@ValidatorConstraint({ name: 'pointsConfigValidator', async: true })
export class PointsConfigValidator {
  private readonly minPointsPerActivity: number;
  private readonly maxPointsPerActivity: number;
  private readonly aiModifierPrecision: number;
  private readonly tenantRules: Map<string, ValidationRule[]>;

  constructor(config: IValidationConfig) {
    this.minPointsPerActivity = config.minPoints || MIN_POINTS_PER_ACTIVITY;
    this.maxPointsPerActivity = config.maxPoints || MAX_POINTS_PER_ACTIVITY;
    this.aiModifierPrecision = config.aiModifierPrecision || 2;
    this.tenantRules = new Map();
  }

  /**
   * Validates base point values for activities with tenant context
   * @param basePoints Base point values for each activity type
   * @param tenantId Tenant identifier for isolation
   */
  public validateBasePoints(basePoints: Record<ActivityType, number>, tenantId: string): boolean {
    // Verify all activity types are present
    const hasAllTypes = Object.values(ActivityType).every(
      type => typeof basePoints[type] === 'number'
    );
    if (!hasAllTypes) {
      throw new Error('All activity types must have point values defined');
    }

    // Validate point values are within bounds
    const validPoints = Object.values(basePoints).every(points => {
      const isValid = points >= this.minPointsPerActivity && 
                     points <= this.maxPointsPerActivity &&
                     Number.isInteger(points);
      if (!isValid) {
        throw new Error(`Point values must be integers between ${this.minPointsPerActivity} and ${this.maxPointsPerActivity}`);
      }
      return isValid;
    });

    // Apply tenant-specific validation rules
    const tenantRules = this.tenantRules.get(tenantId);
    if (tenantRules) {
      const validTenantRules = tenantRules.every(rule => 
        Object.values(basePoints).every(points => rule.validate(points, tenantId))
      );
      if (!validTenantRules) {
        throw new Error('Tenant-specific validation rules failed');
      }
    }

    return validPoints;
  }

  /**
   * Validates AI modifier value with enhanced precision checks
   * @param aiModifier AI detection modifier value
   * @param tenantId Tenant identifier for isolation
   */
  public validateAiModifier(aiModifier: number, tenantId: string): boolean {
    // Check modifier range
    if (aiModifier < 0 || aiModifier > 1) {
      throw new Error('AI modifier must be between 0 and 1');
    }

    // Validate precision
    const precision = aiModifier.toString().split('.')[1]?.length || 0;
    if (precision > this.aiModifierPrecision) {
      throw new Error(`AI modifier must have at most ${this.aiModifierPrecision} decimal places`);
    }

    // Apply tenant-specific validation rules
    const tenantRules = this.tenantRules.get(tenantId);
    if (tenantRules) {
      const validTenantRules = tenantRules.every(rule => rule.validate(aiModifier, tenantId));
      if (!validTenantRules) {
        throw new Error('Tenant-specific AI modifier rules failed');
      }
    }

    return true;
  }
}

/**
 * Validates points configuration object against system rules and constraints
 * @param config Points configuration to validate
 * @param tenantId Tenant identifier for isolation
 */
@ValidateAll()
@Transform(TransformationType.CLASS)
export async function validatePointsConfig(
  config: IPointsConfig,
  tenantId: string
): Promise<boolean> {
  const validator = new PointsConfigValidator({
    minPoints: MIN_POINTS_PER_ACTIVITY,
    maxPoints: MAX_POINTS_PER_ACTIVITY,
    aiModifierPrecision: 2
  });

  // Validate base points configuration
  const validBasePoints = validator.validateBasePoints(config.basePoints, tenantId);
  if (!validBasePoints) {
    return false;
  }

  // Validate AI modifier
  const validAiModifier = validator.validateAiModifier(config.aiModifier, tenantId);
  if (!validAiModifier) {
    return false;
  }

  // Validate tenant context
  if (!isValidPointConfig(config)) {
    throw new Error('Invalid points configuration structure');
  }

  return true;
}

/**
 * Validates point calculation results before awarding
 * @param points Points to validate
 * @param isAiGenerated Flag indicating AI-generated code
 * @param activityType Type of activity
 * @param tenantId Tenant identifier for isolation
 */
@ValidateAll()
export async function validatePointsCalculation(
  points: number,
  isAiGenerated: boolean,
  activityType: ActivityType,
  tenantId: string
): Promise<boolean> {
  // Validate basic point requirements
  if (!Number.isInteger(points) || points < 0) {
    throw new Error('Points must be a non-negative integer');
  }

  // Validate against activity type limits
  const basePoints = ACTIVITY_BASE_POINTS[activityType].basePoints;
  const maxAllowedPoints = basePoints * (isAiGenerated ? DEFAULT_POINTS_CONFIG.aiModifier : 1);
  
  if (points > maxAllowedPoints) {
    throw new Error(`Points exceed maximum allowed for activity type: ${activityType}`);
  }

  // Validate AI modifier application
  if (isAiGenerated) {
    const expectedPoints = Math.floor(basePoints * DEFAULT_POINTS_CONFIG.aiModifier);
    if (points > expectedPoints) {
      throw new Error('AI-generated code points exceed allowed modifier limit');
    }
  }

  // Validate against system bounds
  if (points < MIN_POINTS_PER_ACTIVITY || points > MAX_POINTS_PER_ACTIVITY) {
    throw new Error(`Points must be between ${MIN_POINTS_PER_ACTIVITY} and ${MAX_POINTS_PER_ACTIVITY}`);
  }

  return true;
}

export { PointsConfigValidator, validatePointsConfig, validatePointsCalculation };