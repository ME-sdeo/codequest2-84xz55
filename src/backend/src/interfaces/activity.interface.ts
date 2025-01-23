// @ts-nocheck
/**
 * Activity interface definitions for Azure DevOps activity tracking
 * Version: 1.0.0
 */

/**
 * Enumeration of supported Azure DevOps activity types
 * Maps to point calculation rules defined in technical specifications
 */
export enum ActivityType {
    CODE_CHECKIN = 'CODE_CHECKIN',     // Base: 10 points
    PULL_REQUEST = 'PULL_REQUEST',      // Base: 25 points
    CODE_REVIEW = 'CODE_REVIEW',        // Base: 15 points
    BUG_FIX = 'BUG_FIX',               // Base: 20 points
    STORY_CLOSURE = 'STORY_CLOSURE'     // Base: 30 points
}

/**
 * Detailed metadata interface for Azure DevOps activities
 * Includes comprehensive tracking data and AI detection metrics
 */
export interface IActivityMetadata {
    /** Azure DevOps unique identifier for the activity */
    adoId: string;
    
    /** Repository where the activity occurred */
    repository: string;
    
    /** Branch associated with the activity */
    branch: string;
    
    /** Direct URL to the activity in Azure DevOps */
    url: string;
    
    /** Activity title or summary */
    title: string;
    
    /** Detailed description of the activity */
    description: string;
    
    /** Size metric (e.g., lines of code, story points) */
    size: number;
    
    /** Complexity metric (e.g., cyclomatic complexity) */
    complexity: number;
    
    /** Associated tags or labels */
    tags: string[];
    
    /** AI detection confidence score (0-1) */
    aiConfidence: number;
}

/**
 * Core activity interface for tracking and point calculation
 * Implements complete activity structure with all required fields
 */
export interface IActivity {
    /** Unique identifier for the activity */
    id: UUID;
    
    /** Type of activity performed */
    type: ActivityType;
    
    /** ID of the team member who performed the activity */
    teamMemberId: UUID;
    
    /** Calculated points for the activity */
    points: number;
    
    /** Flag indicating if activity contains AI-generated code */
    isAiGenerated: boolean;
    
    /** Timestamp when activity was created */
    createdAt: Date;
    
    /** Detailed activity metadata */
    metadata: IActivityMetadata;
}

/**
 * Type guard to check if an activity is AI-generated
 * @param activity The activity to check
 * @returns boolean indicating if activity is AI-generated
 */
export function isAiGeneratedActivity(activity: IActivity): boolean {
    return activity.isAiGenerated && activity.metadata.aiConfidence > 0.8;
}

/**
 * Type guard to validate activity type
 * @param type The activity type to validate
 * @returns boolean indicating if type is valid
 */
export function isValidActivityType(type: string): type is ActivityType {
    return Object.values(ActivityType).includes(type as ActivityType);
}

/**
 * Type for activity point calculation modifiers
 */
export type ActivityPointModifier = {
    basePoints: number;
    aiModifier: number;
    orgOverride?: number;
};

/**
 * Mapping of base points for each activity type
 */
export const ACTIVITY_BASE_POINTS: Record<ActivityType, ActivityPointModifier> = {
    [ActivityType.CODE_CHECKIN]: { basePoints: 10, aiModifier: 0.75 },
    [ActivityType.PULL_REQUEST]: { basePoints: 25, aiModifier: 0.75 },
    [ActivityType.CODE_REVIEW]: { basePoints: 15, aiModifier: 0.75 },
    [ActivityType.BUG_FIX]: { basePoints: 20, aiModifier: 0.75 },
    [ActivityType.STORY_CLOSURE]: { basePoints: 30, aiModifier: 0.75 }
};