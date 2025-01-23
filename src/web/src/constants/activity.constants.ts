/**
 * @fileoverview Frontend constants for Azure DevOps activities including display configurations,
 * point values, and activity type mappings for the CodeQuest platform.
 * @version 1.0.0
 */

import { ActivityType } from '../types/activity.types';

/**
 * Display configuration for each activity type in the UI.
 * Maps activity types to their display properties including name, icon, and base points.
 */
export const ACTIVITY_DISPLAY_CONFIG = {
  [ActivityType.CODE_CHECKIN]: {
    displayName: 'Code Check-in',
    icon: 'git-commit',
    basePoints: 10
  },
  [ActivityType.PULL_REQUEST]: {
    displayName: 'Pull Request',
    icon: 'git-pull-request',
    basePoints: 25
  },
  [ActivityType.CODE_REVIEW]: {
    displayName: 'Code Review',
    icon: 'code-review',
    basePoints: 15
  },
  [ActivityType.BUG_FIX]: {
    displayName: 'Bug Fix',
    icon: 'bug',
    basePoints: 20
  },
  [ActivityType.STORY_CLOSURE]: {
    displayName: 'Story Closure',
    icon: 'task-done',
    basePoints: 30
  }
} as const;

/**
 * Base point values for each activity type before any modifiers are applied.
 * These values align with the point calculation rules defined in the technical specification.
 */
export const BASE_POINTS = {
  [ActivityType.CODE_CHECKIN]: 10,
  [ActivityType.PULL_REQUEST]: 25,
  [ActivityType.CODE_REVIEW]: 15,
  [ActivityType.BUG_FIX]: 20,
  [ActivityType.STORY_CLOSURE]: 30
} as const;

/**
 * Point modifier applied to activities detected as AI-generated.
 * AI-generated code receives 75% of the base points as per technical specifications.
 */
export const AI_POINT_MODIFIER = {
  MULTIPLIER: 0.75
} as const;

/**
 * Type guard to check if an activity type is valid
 * @param type The activity type to check
 * @returns boolean indicating if the activity type is valid
 */
export const isValidActivityType = (type: string): type is ActivityType => {
  return Object.values(ActivityType).includes(type as ActivityType);
};

/**
 * Calculate points for an activity considering AI generation
 * @param activityType The type of activity
 * @param isAiGenerated Whether the activity was AI-generated
 * @returns The calculated points for the activity
 */
export const calculateActivityPoints = (
  activityType: ActivityType,
  isAiGenerated: boolean
): number => {
  const basePoints = BASE_POINTS[activityType];
  return isAiGenerated ? basePoints * AI_POINT_MODIFIER.MULTIPLIER : basePoints;
};