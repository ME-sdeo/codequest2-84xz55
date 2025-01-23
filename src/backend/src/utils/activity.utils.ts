/**
 * Activity Utility Functions
 * Version: 1.0.0
 * 
 * Provides utility functions for processing Azure DevOps activities,
 * including point calculations, validation, and normalization.
 */

import { validate, validateOrReject } from 'class-validator';
import { Logger } from 'winston';
import { 
    IActivity, 
    ActivityType,
    isValidActivityType,
    isAiGeneratedActivity 
} from '../interfaces/activity.interface';
import { 
    BASE_POINTS,
    AI_POINT_MODIFIER,
    ACTIVITY_METADATA_KEYS 
} from '../constants/activity.constants';

// Configure logger for activity processing
const logger = new Logger({
    level: 'info',
    format: Logger.format.json(),
    transports: [
        new Logger.transports.Console(),
        new Logger.transports.File({ filename: 'activity-processing.log' })
    ]
});

/**
 * Calculates points for an activity based on type and AI generation status
 * Implements point calculation rules from Technical Specifications A.1.1
 * 
 * @param activityType - Type of activity from ActivityType enum
 * @param isAiGenerated - Flag indicating if activity contains AI-generated code
 * @returns Calculated points with bounds validation
 * @throws Error if activity type is invalid or points calculation fails
 */
export const calculateActivityPoints = (
    activityType: ActivityType,
    isAiGenerated: boolean
): number => {
    try {
        // Validate activity type
        if (!isValidActivityType(activityType)) {
            throw new Error(`Invalid activity type: ${activityType}`);
        }

        // Get base points for activity type
        const basePoints = BASE_POINTS[activityType];
        
        // Validate base points are within acceptable range
        if (basePoints < 0 || basePoints > 100) {
            throw new Error(`Invalid base points value: ${basePoints}`);
        }

        // Calculate final points with AI modifier if applicable
        const finalPoints = isAiGenerated 
            ? Math.round(basePoints * AI_POINT_MODIFIER.MULTIPLIER)
            : basePoints;

        logger.info('Points calculated', {
            activityType,
            basePoints,
            isAiGenerated,
            finalPoints,
            aiModifier: isAiGenerated ? AI_POINT_MODIFIER.MULTIPLIER : 1
        });

        return finalPoints;
    } catch (error) {
        logger.error('Error calculating activity points', {
            activityType,
            isAiGenerated,
            error: error.message
        });
        throw error;
    }
};

/**
 * Validates an activity object for required fields and data types
 * Implements comprehensive validation with enhanced error handling
 * 
 * @param activity - Activity object to validate
 * @returns Promise resolving to true if valid, throws error if invalid
 * @throws Error with detailed validation failures
 */
export const validateActivity = async (activity: IActivity): Promise<boolean> => {
    try {
        // Check for required fields
        const requiredFields = ['id', 'type', 'teamMemberId', 'points', 'createdAt', 'metadata'];
        for (const field of requiredFields) {
            if (!activity[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate activity type
        if (!isValidActivityType(activity.type)) {
            throw new Error(`Invalid activity type: ${activity.type}`);
        }

        // Validate metadata structure
        const requiredMetadata = [
            ACTIVITY_METADATA_KEYS.ADO_ID,
            ACTIVITY_METADATA_KEYS.REPOSITORY,
            ACTIVITY_METADATA_KEYS.URL
        ];
        
        for (const field of requiredMetadata) {
            if (!activity.metadata[field]) {
                throw new Error(`Missing required metadata field: ${field}`);
            }
        }

        // Validate timestamp
        const timestamp = new Date(activity.createdAt);
        if (isNaN(timestamp.getTime())) {
            throw new Error('Invalid timestamp format');
        }

        // Validate points range
        if (activity.points < 0 || activity.points > 100) {
            throw new Error(`Invalid points value: ${activity.points}`);
        }

        logger.info('Activity validated successfully', {
            activityId: activity.id,
            activityType: activity.type
        });

        return true;
    } catch (error) {
        logger.error('Activity validation failed', {
            activityId: activity.id,
            error: error.message
        });
        throw error;
    }
};

/**
 * Normalizes activity data for consistent processing
 * Implements data sanitization and standardization with type safety
 * 
 * @param activity - Activity object to normalize
 * @returns Normalized activity object with type guarantees
 * @throws Error if normalization fails
 */
export const normalizeActivity = (activity: IActivity): IActivity => {
    try {
        const normalized: IActivity = {
            ...activity,
            // Ensure ID is trimmed
            id: activity.id.trim(),
            
            // Normalize activity type
            type: activity.type,
            
            // Ensure teamMemberId is trimmed
            teamMemberId: activity.teamMemberId.trim(),
            
            // Ensure points is a number
            points: Number(activity.points),
            
            // Ensure isAiGenerated is boolean
            isAiGenerated: Boolean(activity.isAiGenerated),
            
            // Convert and validate timestamp
            createdAt: new Date(activity.createdAt),
            
            // Normalize metadata
            metadata: {
                ...activity.metadata,
                adoId: activity.metadata.adoId?.trim(),
                repository: activity.metadata.repository?.trim(),
                branch: activity.metadata.branch?.trim(),
                url: activity.metadata.url?.trim(),
                title: activity.metadata.title?.trim(),
                description: activity.metadata.description?.trim(),
                aiConfidence: Number(activity.metadata.aiConfidence) || 0
            }
        };

        logger.debug('Activity normalized', {
            activityId: normalized.id,
            activityType: normalized.type
        });

        return normalized;
    } catch (error) {
        logger.error('Activity normalization failed', {
            activityId: activity.id,
            error: error.message
        });
        throw error;
    }
};