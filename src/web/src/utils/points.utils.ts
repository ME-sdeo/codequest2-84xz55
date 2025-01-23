/**
 * @fileoverview Utility functions for points calculation, level progression tracking,
 * and leaderboard management with support for AI detection and real-time updates.
 * @version 1.0.0
 */

import { PointsConfig, PointsCalculation, LevelProgress } from '../types/points.types';
import { ActivityType } from '../types/activity.types';
import { DEFAULT_POINTS_CONFIG, LEVEL_THRESHOLDS, POINTS_VALIDATION } from '../constants/points.constants';

/**
 * Interface for point formatting options
 */
interface FormatOptions {
  locale?: string;
  useKSuffix?: boolean;
  decimals?: number;
  showSign?: boolean;
}

/**
 * Calculates points for an activity with AI detection and detailed tracking.
 * Implements the point calculation rules from Technical Specifications A.1.1.
 * 
 * @param activityType - Type of activity being performed
 * @param isAiGenerated - Whether the activity involves AI-generated code
 * @param config - Points configuration with optional org overrides
 * @returns Detailed calculation results including steps and validations
 */
export function calculatePoints(
  activityType: ActivityType,
  isAiGenerated: boolean,
  config: PointsConfig = DEFAULT_POINTS_CONFIG
): PointsCalculation {
  const calculationSteps: string[] = [];
  
  // Get base points from config or organization override
  const basePoints = config.orgOverrides?.[activityType] || 
                    config.basePoints[activityType] ||
                    DEFAULT_POINTS_CONFIG.basePoints[activityType];
  
  calculationSteps.push(`Base points for ${activityType}: ${basePoints}`);

  // Apply AI modifier if applicable
  const aiModifier = isAiGenerated ? (config.aiModifier || DEFAULT_POINTS_CONFIG.aiModifier) : 1;
  const intermediatePoints = basePoints * aiModifier;
  
  if (isAiGenerated) {
    calculationSteps.push(`Applied AI modifier (${aiModifier}x): ${intermediatePoints}`);
  }

  // Validate against min/max constraints
  let finalPoints = Math.max(
    POINTS_VALIDATION.MIN_POINTS,
    Math.min(POINTS_VALIDATION.MAX_POINTS, Math.round(intermediatePoints))
  );

  if (finalPoints !== intermediatePoints) {
    calculationSteps.push(
      `Adjusted points to stay within bounds (${POINTS_VALIDATION.MIN_POINTS}-${POINTS_VALIDATION.MAX_POINTS}): ${finalPoints}`
    );
  }

  return {
    basePoints,
    intermediatePoints,
    aiModifier,
    finalPoints,
    activityType,
    calculationSteps
  };
}

/**
 * Calculates user's current level and progress with enhanced tracking.
 * Uses binary search for efficient level determination.
 * 
 * @param totalPoints - Total accumulated points
 * @returns Detailed level progress including thresholds and percentage
 */
export function calculateLevelProgress(totalPoints: number): LevelProgress {
  // Validate input
  if (totalPoints < 0) {
    throw new Error('Total points cannot be negative');
  }

  const thresholds = Object.entries(LEVEL_THRESHOLDS)
    .map(([level, points]) => ({ level: parseInt(level), points }))
    .sort((a, b) => a.points - b.points);

  // Binary search for current level
  let currentLevel = 1;
  let previousLevelThreshold = 0;
  let nextLevelThreshold = thresholds[1].points;

  for (let i = 0; i < thresholds.length; i++) {
    if (totalPoints >= thresholds[i].points) {
      currentLevel = thresholds[i].level;
      previousLevelThreshold = thresholds[i].points;
      nextLevelThreshold = thresholds[i + 1]?.points || previousLevelThreshold * 2;
    } else {
      break;
    }
  }

  // Calculate progress percentage
  const pointsInCurrentLevel = totalPoints - previousLevelThreshold;
  const pointsRequiredForNextLevel = nextLevelThreshold - previousLevelThreshold;
  const progressPercentage = Math.min(
    100,
    (pointsInCurrentLevel / pointsRequiredForNextLevel) * 100
  ) as number & { _brand: 'Percentage' };

  return {
    currentLevel,
    totalPoints,
    nextLevelThreshold,
    previousLevelThreshold,
    pointsToNextLevel: nextLevelThreshold - totalPoints,
    progressPercentage
  };
}

/**
 * Formats point values with localization and customization options.
 * Supports different numerical ranges and formatting options.
 * 
 * @param points - Point value to format
 * @param options - Formatting options
 * @returns Formatted point value string
 */
export function formatPoints(
  points: number,
  options: FormatOptions = {}
): string {
  const {
    locale = 'en-US',
    useKSuffix = true,
    decimals = 1,
    showSign = false
  } = options;

  // Handle edge cases
  if (!Number.isFinite(points)) {
    return '---';
  }

  const absPoints = Math.abs(points);
  let formattedValue: string;
  let suffix = '';

  // Apply K/M suffixes for large numbers
  if (useKSuffix && absPoints >= 1000000) {
    formattedValue = (absPoints / 1000000).toFixed(decimals);
    suffix = 'M';
  } else if (useKSuffix && absPoints >= 1000) {
    formattedValue = (absPoints / 1000).toFixed(decimals);
    suffix = 'K';
  } else {
    formattedValue = absPoints.toFixed(decimals);
  }

  // Remove trailing zeros after decimal
  formattedValue = formattedValue.replace(/\.?0+$/, '');

  // Apply localization
  const numberFormat = new Intl.NumberFormat(locale);
  formattedValue = numberFormat.format(parseFloat(formattedValue));

  // Add sign if requested
  const sign = points < 0 ? '-' : (showSign ? '+' : '');

  return `${sign}${formattedValue}${suffix}`;
}