/**
 * Activity Constants for Azure DevOps Integration
 * Version: 1.0.0
 * 
 * Defines constant values and configurations for Azure DevOps activity tracking,
 * including point values, AI modifiers, and activity type mappings.
 */

import { ActivityType } from '../interfaces/activity.interface';

/**
 * Base point values for each activity type
 * Values defined according to technical specifications A.1.1
 */
export const BASE_POINTS: Record<ActivityType, number> = {
    [ActivityType.CODE_CHECKIN]: 10,    // Points for code commit
    [ActivityType.PULL_REQUEST]: 25,    // Points for creating PR
    [ActivityType.CODE_REVIEW]: 15,     // Points for completing review
    [ActivityType.BUG_FIX]: 20,         // Points for bug resolution
    [ActivityType.STORY_CLOSURE]: 30    // Points for completing story
} as const;

/**
 * AI code detection point modifier
 * Applied as a multiplier to base points when code is AI-generated
 */
export const AI_POINT_MODIFIER = {
    MULTIPLIER: 0.75  // 25% reduction for AI-generated code
} as const;

/**
 * Standard metadata keys for activity tracking
 * Provides consistent field naming across the application
 */
export const ACTIVITY_METADATA_KEYS = {
    // Azure DevOps specific identifiers
    ADO_ID: 'adoId',
    REPOSITORY: 'repository',
    BRANCH: 'branch',
    URL: 'url',

    // Activity details
    TITLE: 'title',
    DESCRIPTION: 'description',
    CREATED_AT: 'createdAt',
    UPDATED_AT: 'updatedAt',

    // AI detection
    IS_AI_GENERATED: 'isAiGenerated'
} as const;

/**
 * Type assertion to ensure BASE_POINTS contains all ActivityType values
 * This provides compile-time verification of point value completeness
 */
const _exhaustivenessCheck: Record<ActivityType, number> = BASE_POINTS;

// Prevent modifications to constant values
Object.freeze(BASE_POINTS);
Object.freeze(AI_POINT_MODIFIER);
Object.freeze(ACTIVITY_METADATA_KEYS);