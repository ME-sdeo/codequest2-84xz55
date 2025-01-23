/**
 * Activity Validator Implementation
 * Version: 1.0.0
 * 
 * Provides comprehensive validation for Azure DevOps activities including:
 * - Point calculation validation
 * - Activity metadata validation
 * - DTO validation for activity creation
 */

import { validate } from 'class-validator'; // v0.14.0
import { IActivity, ActivityType } from '../interfaces/activity.interface';
import { BASE_POINTS, AI_POINT_MODIFIER } from '../constants/activity.constants';
import { CreateActivityDto } from '../dto/activity/create-activity.dto';

/**
 * Interface for validation results
 */
interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Required metadata fields for each activity type
 */
const REQUIRED_METADATA_FIELDS: Record<ActivityType, string[]> = {
    [ActivityType.CODE_CHECKIN]: ['adoId', 'repository', 'branch', 'url'],
    [ActivityType.PULL_REQUEST]: ['adoId', 'repository', 'branch', 'url', 'title', 'description'],
    [ActivityType.CODE_REVIEW]: ['adoId', 'repository', 'url', 'title'],
    [ActivityType.BUG_FIX]: ['adoId', 'url', 'title', 'description'],
    [ActivityType.STORY_CLOSURE]: ['adoId', 'url', 'title', 'description']
};

/**
 * Validates the calculated points for an activity based on its type,
 * AI generation status, and organizational overrides
 * 
 * @param activity - The activity to validate
 * @param orgOverrides - Organization-specific point overrides
 * @returns ValidationResult with validation status and any errors
 */
export function validateActivityPoints(
    activity: IActivity,
    orgOverrides?: Record<ActivityType, number>
): ValidationResult {
    const errors: string[] = [];
    
    // Validate activity type exists in BASE_POINTS
    if (!(activity.type in BASE_POINTS)) {
        errors.push(`Invalid activity type: ${activity.type}`);
        return { isValid: false, errors };
    }

    // Get base points for activity type
    let points = BASE_POINTS[activity.type];

    // Apply organization override if present
    if (orgOverrides && orgOverrides[activity.type]) {
        points = orgOverrides[activity.type];
    }

    // Validate and apply AI point modifier
    if (activity.isAiGenerated) {
        // Validate AI confidence threshold
        if (!activity.metadata.aiConfidence || activity.metadata.aiConfidence < 0 || activity.metadata.aiConfidence > 1) {
            errors.push('AI confidence must be between 0 and 1');
        }
        
        // Apply AI point modifier
        points *= AI_POINT_MODIFIER.MULTIPLIER;
    }

    // Validate final point calculation
    if (points <= 0) {
        errors.push('Calculated points must be greater than 0');
    }

    // Validate point precision (no more than 2 decimal places)
    if (Math.round(points * 100) / 100 !== points) {
        errors.push('Points must have no more than 2 decimal places');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates the metadata structure and required fields for an activity
 * based on its type
 * 
 * @param metadata - The activity metadata to validate
 * @param activityType - The type of activity
 * @returns ValidationResult with validation status and any errors
 */
export function validateActivityMetadata(
    metadata: Record<string, any>,
    activityType: ActivityType
): ValidationResult {
    const errors: string[] = [];

    // Check required fields based on activity type
    const requiredFields = REQUIRED_METADATA_FIELDS[activityType];
    for (const field of requiredFields) {
        if (!metadata[field]) {
            errors.push(`Missing required metadata field: ${field}`);
        }
    }

    // Validate field types and formats
    if (metadata.adoId && typeof metadata.adoId !== 'string') {
        errors.push('adoId must be a string');
    }

    if (metadata.url && !isValidUrl(metadata.url)) {
        errors.push('url must be a valid URL');
    }

    if (metadata.size && (typeof metadata.size !== 'number' || metadata.size < 0)) {
        errors.push('size must be a positive number');
    }

    if (metadata.complexity && (typeof metadata.complexity !== 'number' || metadata.complexity < 0)) {
        errors.push('complexity must be a positive number');
    }

    // Validate AI-related fields if AI-generated
    if (metadata.isAiGenerated) {
        if (typeof metadata.aiConfidence !== 'number' || 
            metadata.aiConfidence < 0 || 
            metadata.aiConfidence > 1) {
            errors.push('aiConfidence must be a number between 0 and 1');
        }
    }

    // Validate string length restrictions
    if (metadata.title && metadata.title.length > 200) {
        errors.push('title must not exceed 200 characters');
    }

    if (metadata.description && metadata.description.length > 2000) {
        errors.push('description must not exceed 2000 characters');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates a CreateActivityDto instance using class-validator decorators
 * 
 * @param dto - The CreateActivityDto instance to validate
 * @returns Promise<ValidationResult> with validation status and any errors
 */
export async function validateCreateActivityDto(
    dto: CreateActivityDto
): Promise<ValidationResult> {
    const errors: string[] = [];

    // Perform class-validator validation
    const validationErrors = await validate(dto);
    
    if (validationErrors.length > 0) {
        // Map validation errors to strings
        errors.push(...validationErrors.map(error => 
            Object.values(error.constraints || {}).join(', ')
        ));
    }

    // Validate metadata if DTO is otherwise valid
    if (errors.length === 0 && dto.metadata) {
        const metadataValidation = validateActivityMetadata(dto.metadata, dto.type);
        if (!metadataValidation.isValid) {
            errors.push(...metadataValidation.errors);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Helper function to validate URLs
 * @param url - The URL to validate
 * @returns boolean indicating if URL is valid
 */
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}