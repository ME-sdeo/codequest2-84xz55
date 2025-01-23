/**
 * @fileoverview Core interfaces and types for the points system
 * Implements points configuration, calculation, and history tracking with tenant isolation
 * @version 1.0.0
 */

import { UUID } from 'crypto';
import { ActivityType } from './activity.interface';
import { TenantContext } from './tenant.interface';

/**
 * Interface for points configuration with enhanced type safety and tenant isolation
 * Based on Point Calculation Rules from technical specifications A.1.1
 */
export interface IPointsConfig {
  /** Base point values for each activity type */
  readonly basePoints: Readonly<Record<ActivityType, number>>;
  
  /** AI detection modifier (default 0.75) */
  readonly aiModifier: number;
  
  /** Point thresholds for each level */
  readonly levelThresholds: Readonly<Record<number, number>>;
  
  /** Tenant identifier for isolation */
  readonly tenantId: UUID;
  
  /** Tenant context for configuration */
  readonly tenantContext: TenantContext;
  
  /** Validation functions for point configuration */
  readonly validation: PointConfigValidation;
}

/**
 * Interface for tracking point history entries with tenant isolation
 * Implements comprehensive activity tracking requirements
 */
export interface IPointsHistory {
  /** Unique identifier for the history entry */
  readonly id: UUID;
  
  /** Team member who earned the points */
  readonly teamMemberId: UUID;
  
  /** Associated activity identifier */
  readonly activityId: UUID;
  
  /** Points earned for the activity */
  readonly points: number;
  
  /** Type of activity performed */
  readonly activityType: ActivityType;
  
  /** Flag indicating if points were earned from AI-generated code */
  readonly isAiGenerated: boolean;
  
  /** Timestamp of point award */
  readonly createdAt: Date;
  
  /** Tenant identifier for isolation */
  readonly tenantId: UUID;
}

/**
 * Interface for point calculation results with tenant context
 * Implements point calculation rules from A.1.1
 */
export interface IPointsCalculation {
  /** Original base points for the activity */
  readonly basePoints: number;
  
  /** AI modifier applied (if applicable) */
  readonly aiModifier: number;
  
  /** Final calculated points after all modifiers */
  readonly finalPoints: number;
  
  /** Type of activity for the calculation */
  readonly activityType: ActivityType;
  
  /** Tenant identifier for isolation */
  readonly tenantId: UUID;
}

/**
 * Interface for tracking level progress with tenant context
 * Implements level progression system
 */
export interface ILevelProgress {
  /** Current level of the team member */
  readonly currentLevel: number;
  
  /** Total accumulated points */
  readonly totalPoints: number;
  
  /** Points required for next level */
  readonly nextLevelThreshold: number;
  
  /** Progress percentage to next level */
  readonly progressPercentage: number;
  
  /** Tenant identifier for isolation */
  readonly tenantId: UUID;
}

/**
 * Type definitions for point configuration validation
 * Implements validation rules for point system configuration
 */
export type PointConfigValidation = {
  /** Validates point values are within acceptable range */
  isValidPointValue: (points: number) => boolean;
  
  /** Validates AI modifier is between 0 and 1 */
  isValidAiModifier: (modifier: number) => boolean;
  
  /** Validates level thresholds are properly incremental */
  isValidLevelThreshold: (threshold: number) => boolean;
};