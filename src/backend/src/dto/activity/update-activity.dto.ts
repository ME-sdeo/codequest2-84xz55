/**
 * Data Transfer Object (DTO) for updating existing Azure DevOps activities
 * Version: 1.0.0
 * 
 * Implements validation for:
 * - Activity type enumeration
 * - Points calculation rules (7.5-30 points range)
 * - AI detection status
 * - Activity-specific metadata
 */

import { 
    IsOptional, 
    IsEnum, 
    IsBoolean, 
    IsNumber, 
    IsObject,
    Min,
    Max,
    ValidateNested 
} from 'class-validator'; // ^0.14.0
import { ActivityType } from '../../interfaces/activity.interface';

/**
 * DTO for partial updates to existing activities
 * Supports updating activity type, AI detection status, points, and metadata
 * All fields are optional to allow partial updates
 */
export class UpdateActivityDto {
    /**
     * Type of Azure DevOps activity
     * Must be one of the predefined ActivityType enum values
     * @example ActivityType.CODE_CHECKIN
     */
    @IsOptional()
    @IsEnum(ActivityType)
    type?: ActivityType;

    /**
     * Flag indicating if the activity contains AI-generated code
     * Affects point calculation with 0.75x multiplier when true
     * @example true
     */
    @IsOptional()
    @IsBoolean()
    isAiGenerated?: boolean;

    /**
     * Points awarded for the activity
     * Range: 7.5-30 points (minimum accounts for AI modifier on smallest base points)
     * Maximum aligns with highest base points (STORY_CLOSURE)
     * @example 15
     */
    @IsOptional()
    @IsNumber()
    @Min(7.5) // Minimum points after AI modifier (10 * 0.75)
    @Max(30)  // Maximum base points (STORY_CLOSURE)
    points?: number;

    /**
     * Additional metadata for the activity
     * Structured as key-value pairs for flexibility
     * @example { adoId: "12345", repository: "main-repo", complexity: 5 }
     */
    @IsOptional()
    @IsObject()
    @ValidateNested()
    metadata?: Record<string, any>;
}