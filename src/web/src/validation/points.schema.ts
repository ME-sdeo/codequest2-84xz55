/**
 * @fileoverview Zod validation schemas for points-related data structures in CodeQuest.
 * Implements comprehensive validation rules for points configuration, history tracking,
 * and level progression with detailed error messages and security controls.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.0.0
import { ActivityType } from '../types/activity.types';
import { PointsConfig } from '../types/points.types';
import { DEFAULT_POINTS_CONFIG } from '../constants/points.constants';

// Global validation constants
const MIN_POINTS = 5;
const MAX_POINTS = 100;
const MIN_AI_MODIFIER = 0.5;
const MAX_AI_MODIFIER = 1.0;
const MIN_LEVEL = 1;
const MAX_LEVEL = 100;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Comprehensive validation schema for points configuration.
 * Enforces strict rules for point values, AI modifiers, and level thresholds.
 */
export const pointsConfigSchema = z.object({
  basePoints: z.record(
    z.nativeEnum(ActivityType),
    z.number()
      .int()
      .min(MIN_POINTS, 'Base points must be at least 5')
      .max(MAX_POINTS, 'Base points cannot exceed 100')
      .describe('Base points for activities')
  ).refine(
    (points) => Object.keys(points).length === Object.keys(ActivityType).length,
    'All activity types must have base points defined'
  ),

  aiModifier: z.number()
    .min(MIN_AI_MODIFIER, 'AI modifier must be at least 0.5')
    .max(MAX_AI_MODIFIER, 'AI modifier cannot exceed 1.0')
    .describe('AI detection modifier'),

  levelThresholds: z.record(
    z.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
    z.number().positive().describe('Points required for level')
  ).refine(
    (thresholds) => {
      const levels = Object.keys(thresholds).map(Number).sort((a, b) => a - b);
      return levels.every((level, index) => 
        index === 0 || thresholds[level] > thresholds[levels[index - 1]]
      );
    },
    'Level thresholds must be strictly increasing'
  ),

  orgOverrides: z.record(
    z.string().uuid().regex(UUID_REGEX, 'Invalid UUID format'),
    z.record(
      z.nativeEnum(ActivityType),
      z.number().int().min(MIN_POINTS).max(MAX_POINTS)
    )
  ).optional()
}).refine(
  (config) => {
    const defaultConfig = DEFAULT_POINTS_CONFIG;
    return Object.keys(config.basePoints).every(
      (type) => config.basePoints[type as ActivityType] >= defaultConfig.basePoints[type as ActivityType] * 0.5
    );
  },
  'Base points cannot be less than 50% of default values'
);

/**
 * Validation schema for points history entries with security controls.
 * Ensures data integrity and prevents injection attacks.
 */
export const pointsHistorySchema = z.object({
  teamMemberId: z.string()
    .uuid()
    .regex(UUID_REGEX, 'Invalid team member ID format'),
  
  activityId: z.string()
    .uuid()
    .regex(UUID_REGEX, 'Invalid activity ID format'),
  
  points: z.number()
    .int()
    .min(MIN_POINTS, 'Points must be at least 5')
    .max(MAX_POINTS, 'Points cannot exceed 100'),
  
  activityType: z.nativeEnum(ActivityType, {
    errorMap: () => ({ message: 'Invalid activity type' })
  }),
  
  isAiGenerated: z.boolean(),
  
  createdAt: z.date(),
  
  metadata: z.record(
    z.string(),
    z.string()
      .trim()
      .min(1, 'Metadata values cannot be empty')
      .max(1000, 'Metadata values cannot exceed 1000 characters')
      .regex(/^[^<>]*$/, 'HTML tags are not allowed')
  ).optional()
}).refine(
  (data) => {
    if (data.isAiGenerated) {
      return data.points <= data.points * MAX_AI_MODIFIER;
    }
    return true;
  },
  'AI-generated activities must have reduced points'
);

/**
 * Validation schema for point calculations with AI modifier rules.
 * Ensures accurate point calculations and maintains audit trail.
 */
export const pointsCalculationSchema = z.object({
  basePoints: z.number()
    .int()
    .min(MIN_POINTS)
    .max(MAX_POINTS),
  
  aiModifier: z.number()
    .min(MIN_AI_MODIFIER)
    .max(MAX_AI_MODIFIER),
  
  finalPoints: z.number()
    .int()
    .min(MIN_POINTS)
    .max(MAX_POINTS),
  
  activityType: z.nativeEnum(ActivityType),
  
  calculationSteps: z.array(
    z.object({
      step: z.string()
        .min(1, 'Step description is required')
        .max(200, 'Step description too long'),
      value: z.number()
    })
  ).min(1, 'At least one calculation step is required')
}).refine(
  (calc) => {
    const finalStep = calc.calculationSteps[calc.calculationSteps.length - 1];
    return finalStep.value === calc.finalPoints;
  },
  'Final calculation step must match final points'
).refine(
  (calc) => {
    if (calc.isAiGenerated) {
      return calc.finalPoints === Math.floor(calc.basePoints * calc.aiModifier);
    }
    return calc.finalPoints === calc.basePoints;
  },
  'Points calculation must follow AI modifier rules'
);