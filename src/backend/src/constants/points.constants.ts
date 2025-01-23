/**
 * Points and Rewards System Constants
 * Version: 1.0.0
 * 
 * Defines constant values and configurations for the CodeQuest points system
 * including base point values, level thresholds, and achievement requirements.
 */

import { ActivityType } from '../interfaces/activity.interface';

/**
 * Achievement types supported by the system
 */
export enum AchievementType {
    CODE_MASTER = 'CODE_MASTER',
    BUG_HUNTER = 'BUG_HUNTER',
    TEAM_PLAYER = 'TEAM_PLAYER'
}

/**
 * Interface for points configuration validation
 */
interface PointsConfiguration {
    basePoints: Record<ActivityType, number>;
    aiModifier: number;
    version: string;
}

/**
 * Default point configuration for new tenants
 * Implements the point calculation rules from technical specifications
 */
export const DEFAULT_POINTS_CONFIG: Readonly<PointsConfiguration> = {
    basePoints: {
        [ActivityType.CODE_CHECKIN]: 10,
        [ActivityType.PULL_REQUEST]: 25,
        [ActivityType.CODE_REVIEW]: 15,
        [ActivityType.BUG_FIX]: 20,
        [ActivityType.STORY_CLOSURE]: 30
    },
    aiModifier: 0.75,
    version: '1.0.0'
} as const;

/**
 * Level thresholds defining point requirements for each level
 * Using Map for O(1) lookup performance
 */
export const LEVEL_THRESHOLDS: Readonly<Map<number, number>> = new Map([
    [1, 0],
    [2, 500],
    [3, 1000],
    [4, 2000],
    [5, 3500],
    [10, 10000],
    [15, 25000]
]);

/**
 * Achievement requirements defining point thresholds for badges
 */
export const ACHIEVEMENT_REQUIREMENTS: Readonly<Record<AchievementType, number>> = {
    [AchievementType.CODE_MASTER]: 5000,
    [AchievementType.BUG_HUNTER]: 3000,
    [AchievementType.TEAM_PLAYER]: 4000
} as const;

/**
 * System-wide constants for points configuration
 */
export const POINTS_RETENTION_PERIOD = '12 months';
export const MIN_POINTS_PER_ACTIVITY = 5;
export const MAX_POINTS_PER_ACTIVITY = 100;
export const POINTS_CONFIG_VERSION = '1.0.0';

/**
 * Validates point configuration values against defined boundaries
 * @param config Points configuration to validate
 * @returns boolean indicating if configuration is valid
 */
export function validatePointsConfig(config: PointsConfiguration): boolean {
    // Validate all base points are within bounds
    const validBasePoints = Object.values(config.basePoints).every(
        points => points >= MIN_POINTS_PER_ACTIVITY && points <= MAX_POINTS_PER_ACTIVITY
    );

    // Validate AI modifier is between 0 and 1
    const validAiModifier = config.aiModifier >= 0 && config.aiModifier <= 1;

    // Ensure all activity types have points defined
    const hasAllActivityTypes = Object.values(ActivityType).every(
        type => typeof config.basePoints[type] === 'number'
    );

    // Verify version format
    const validVersion = /^\d+\.\d+\.\d+$/.test(config.version);

    return validBasePoints && validAiModifier && hasAllActivityTypes && validVersion;
}

/**
 * Type guard to check if a level threshold exists
 * @param level Level number to check
 * @returns boolean indicating if level threshold is defined
 */
export function isValidLevel(level: number): boolean {
    return LEVEL_THRESHOLDS.has(level);
}

/**
 * Type guard to check if an achievement type is valid
 * @param achievement Achievement type to validate
 * @returns boolean indicating if achievement type is valid
 */
export function isValidAchievement(achievement: string): achievement is AchievementType {
    return Object.values(AchievementType).includes(achievement as AchievementType);
}