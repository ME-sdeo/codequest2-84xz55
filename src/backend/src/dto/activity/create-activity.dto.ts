/**
 * Data Transfer Object (DTO) for creating new Azure DevOps activities
 * Version: 1.0.0
 * 
 * Implements comprehensive validation for activity creation with support for:
 * - Team member identification
 * - Activity type validation
 * - AI code detection
 * - Detailed activity metadata
 */

import { IsUUID, IsEnum, IsBoolean, IsObject, ValidateNested } from 'class-validator'; // v0.14.0
import { Type } from 'class-transformer'; // v0.5.1
import { ActivityType, IActivityMetadata } from '../../interfaces/activity.interface';

export class CreateActivityDto {
    /**
     * Unique identifier of the team member performing the activity
     * Must be a valid UUID v4
     */
    @IsUUID(4, { message: 'Team member ID must be a valid UUID v4' })
    teamMemberId: string;

    /**
     * Type of activity being performed
     * Must match one of the defined ActivityType enum values:
     * - CODE_CHECKIN (10 points)
     * - PULL_REQUEST (25 points)
     * - CODE_REVIEW (15 points)
     * - BUG_FIX (20 points)
     * - STORY_CLOSURE (30 points)
     */
    @IsEnum(ActivityType, { message: 'Activity type must be a valid ActivityType enum value' })
    type: ActivityType;

    /**
     * Flag indicating whether the activity contains AI-generated code
     * Affects point calculation (75% of base points for AI-generated code)
     */
    @IsBoolean({ message: 'isAiGenerated must be a boolean value' })
    isAiGenerated: boolean;

    /**
     * Detailed metadata about the activity from Azure DevOps
     * Must conform to IActivityMetadata interface structure
     */
    @IsObject({ message: 'Activity metadata must be a valid object' })
    @ValidateNested()
    @Type(() => Object)
    metadata: IActivityMetadata;
}