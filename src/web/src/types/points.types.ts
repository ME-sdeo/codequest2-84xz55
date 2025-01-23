/**
 * @fileoverview TypeScript type definitions for the points and leveling system.
 * Defines interfaces and types for point calculations, history tracking, and level progression.
 * @version 1.0.0
 */

import { BaseEntity, TenantEntity } from './common.types';
import { ActivityType } from './activity.types';

/**
 * Configuration interface for points system with tenant isolation.
 * Defines base point values and modifiers for different activity types.
 */
export interface PointsConfig extends TenantEntity {
  /** Base point values for each activity type */
  basePoints: Record<ActivityType, number>;
  /** Modifier applied to AI-generated code (default: 0.75) */
  aiModifier: number;
  /** Point thresholds required for each level */
  levelThresholds: Record<number, number>;
}

/**
 * Interface for points history entries with activity tracking.
 * Records individual point-earning events with detailed metadata.
 */
export interface PointsHistory extends BaseEntity {
  /** ID of the team member who earned the points */
  teamMemberId: string;
  /** Reference to the activity that earned points */
  activityId: string;
  /** Points earned for this activity */
  points: number;
  /** Type of activity that earned points */
  activityType: ActivityType;
  /** Indicates if points were earned from AI-generated code */
  isAiGenerated: boolean;
}

/**
 * Interface for detailed point calculation results with audit trail.
 * Tracks each step of the point calculation process for transparency.
 */
export interface PointsCalculation {
  /** Initial base points for the activity type */
  basePoints: number;
  /** Points after applying organization-specific modifiers */
  intermediatePoints: number;
  /** AI modifier applied (if applicable) */
  aiModifier: number;
  /** Final calculated points after all modifiers */
  finalPoints: number;
  /** Type of activity being calculated */
  activityType: ActivityType;
  /** Ordered array of calculation steps for audit trail */
  calculationSteps: string[];
}

/**
 * Enhanced interface for level progression tracking with detailed metrics.
 * Provides comprehensive progress information for UI display.
 */
export interface LevelProgress {
  /** Current level of the team member */
  currentLevel: number;
  /** Total accumulated points */
  totalPoints: number;
  /** Points required for next level */
  nextLevelThreshold: number;
  /** Points required for current level */
  previousLevelThreshold: number;
  /** Remaining points needed for next level */
  pointsToNextLevel: number;
  /** Progress percentage towards next level (branded type for type safety) */
  progressPercentage: number & { _brand: 'Percentage' };
}

/**
 * Enhanced interface for leaderboard display entries with activity history.
 * Combines point totals with recent activity data for rich UI display.
 */
export interface LeaderboardEntry {
  /** ID of the team member */
  teamMemberId: string;
  /** Display name for the team member */
  displayName: string;
  /** Total accumulated points */
  totalPoints: number;
  /** Current level */
  level: number;
  /** Current rank on leaderboard (branded type for positive numbers) */
  rank: number & { _brand: 'PositiveNumber' };
  /** Timestamp of most recent activity */
  lastActivityTimestamp: Date;
  /** Array of recent activity types */
  recentActivities: ActivityType[];
}