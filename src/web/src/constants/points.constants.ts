/**
 * @fileoverview Constants for the CodeQuest points and rewards system.
 * Defines immutable, type-safe constants for point values, level thresholds,
 * achievement requirements, and validation constraints.
 * @version 1.0.0
 */

import { ActivityType } from '../types/activity.types';

/**
 * Default point configuration for activities.
 * Maps each activity type to its base point value and defines the AI modifier.
 */
export const DEFAULT_POINTS_CONFIG = {
  basePoints: {
    [ActivityType.CODE_CHECKIN]: 10,
    [ActivityType.PULL_REQUEST]: 25,
    [ActivityType.CODE_REVIEW]: 15,
    [ActivityType.BUG_FIX]: 20,
    [ActivityType.STORY_CLOSURE]: 30
  },
  aiModifier: 0.75
} as const;

/**
 * Point thresholds required for each level.
 * Maps level numbers to their required point totals.
 * Key levels defined based on UI requirements and progression curve.
 */
export const LEVEL_THRESHOLDS = {
  1: 0,      // Starting level
  2: 500,    // Early progression
  3: 1000,   // Developer
  4: 2000,   // Experienced
  5: 3500,   // Advanced
  10: 10000, // Expert
  15: 25000  // Master
} as const;

/**
 * Point requirements for earning achievement badges.
 * Defines the total points needed to unlock each achievement.
 */
export const ACHIEVEMENT_REQUIREMENTS = {
  CODE_MASTER: 5000,  // Expert-level code contributions
  BUG_HUNTER: 3000,   // Significant bug fixing activity
  TEAM_PLAYER: 4000   // Collaborative development efforts
} as const;

/**
 * Validation constraints for the points system.
 * Defines boundaries and limits for point calculations.
 */
export const POINTS_VALIDATION = {
  MIN_POINTS: 5,              // Minimum points per activity
  MAX_POINTS: 100,           // Maximum points per activity
  RETENTION_PERIOD: '12 months' // Historical data retention
} as const;

// Type assertions to ensure immutability
type PointsConfig = typeof DEFAULT_POINTS_CONFIG;
type LevelThresholds = typeof LEVEL_THRESHOLDS;
type AchievementRequirements = typeof ACHIEVEMENT_REQUIREMENTS;
type PointsValidation = typeof POINTS_VALIDATION;

// Validate that all activity types are covered in points config
type ValidateActivityTypes = keyof typeof DEFAULT_POINTS_CONFIG.basePoints extends ActivityType ? true : never;
type ValidatePointsConfig = ValidateActivityTypes extends never ? never : PointsConfig;