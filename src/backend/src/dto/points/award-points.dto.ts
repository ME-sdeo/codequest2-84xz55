/**
 * @fileoverview Data Transfer Object for validating and processing point awards
 * Implements point calculation rules and validation from technical specifications A.1.1
 * @version 1.0.0
 */

import { IsUUID, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ActivityType } from '../../interfaces/activity.interface';
import { IPointsCalculation } from '../../interfaces/points.interface';

/**
 * Minimum allowed points for any activity as per technical specifications
 * @constant {number}
 */
export const MIN_POINTS: number = 5;

/**
 * Maximum allowed points for any activity as per technical specifications
 * @constant {number}
 */
export const MAX_POINTS: number = 100;

/**
 * Data Transfer Object for validating and processing point awards to team members.
 * Ensures data integrity and enforces business rules for point allocation.
 * Implements real-time point calculation with AI detection support.
 */
export class AwardPointsDto implements Pick<IPointsCalculation, 'basePoints'> {
    /**
     * UUID of the team member receiving points
     * Must be a valid v4 UUID
     */
    @IsUUID('4', { message: 'Invalid team member ID format' })
    teamMemberId: string;

    /**
     * UUID of the Azure DevOps activity
     * Must be a valid v4 UUID
     */
    @IsUUID('4', { message: 'Invalid activity ID format' })
    activityId: string;

    /**
     * Type of activity being awarded points
     * Must be a valid ActivityType enum value
     */
    @IsEnum(ActivityType, { message: 'Invalid activity type' })
    activityType: ActivityType;

    /**
     * Flag indicating if the activity contains AI-generated code
     * Affects point calculation through AI modifier
     */
    @IsBoolean({ message: 'AI generation flag must be a boolean' })
    isAiGenerated: boolean;

    /**
     * Base points to be awarded before AI modification
     * Must be within MIN_POINTS and MAX_POINTS range
     */
    @IsNumber({}, { message: 'Base points must be a number' })
    @Min(MIN_POINTS, { message: `Minimum points allowed is ${MIN_POINTS}` })
    @Max(MAX_POINTS, { message: `Maximum points allowed is ${MAX_POINTS}` })
    basePoints: number;
}