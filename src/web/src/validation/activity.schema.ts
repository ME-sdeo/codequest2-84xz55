/**
 * @fileoverview Zod validation schemas for Azure DevOps activities in the frontend application.
 * Implements strict validation rules for activity data to ensure data integrity and type safety.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.21.4
import { ActivityType } from '../types/activity.types';
import { BASE_POINTS, AI_POINT_MODIFIER } from '../constants/activity.constants';

/**
 * Validation schema for activity metadata.
 * Enforces strict validation rules for Azure DevOps-specific metadata.
 */
export const activityMetadataSchema = z.object({
  adoId: z.string().uuid(),
  repository: z.string().min(1).max(255),
  branch: z.string().min(1).max(255),
  url: z.string().url().max(2048),
  title: z.string().min(1).max(255),
  description: z.string().optional().max(4096)
});

/**
 * Custom validator function to ensure points match activity type and AI status.
 * Validates that points are calculated correctly based on activity type and AI detection.
 */
const validateActivityPoints = (
  activityData: z.infer<typeof activitySchema>
): boolean => {
  const basePoints = BASE_POINTS[activityData.type];
  const expectedPoints = activityData.isAiGenerated
    ? basePoints * AI_POINT_MODIFIER.MULTIPLIER
    : basePoints;

  // Round to 2 decimal places for floating-point comparison
  const roundedExpectedPoints = Math.round(expectedPoints * 100) / 100;
  const roundedActualPoints = Math.round(activityData.points * 100) / 100;

  if (roundedActualPoints !== roundedExpectedPoints) {
    throw new z.ZodError([{
      code: z.ZodIssueCode.custom,
      path: ['points'],
      message: `Points must be ${roundedExpectedPoints} for ${activityData.type} ${
        activityData.isAiGenerated ? 'with' : 'without'
      } AI generation`
    }]);
  }

  return true;
};

/**
 * Comprehensive validation schema for activity data.
 * Combines all validation rules including custom point validation.
 */
export const activitySchema = z.object({
  type: z.nativeEnum(ActivityType),
  teamMemberId: z.string().uuid(),
  points: z
    .number()
    .positive()
    .multipleOf(0.01)
    .max(1000),
  isAiGenerated: z.boolean(),
  metadata: activityMetadataSchema
}).superRefine(validateActivityPoints);

/**
 * Type inference helpers for TypeScript integration
 */
export type ActivityMetadata = z.infer<typeof activityMetadataSchema>;
export type ActivityValidation = z.infer<typeof activitySchema>;