import { Injectable, Logger } from '@nestjs/common'; // ^10.0.0
import { ActivityRepository } from '../../repositories/activity.repository';
import { AiDetectionService } from '../../services/ai-detection.service';
import { QueueService } from '../../services/queue.service';
import { IActivity, ActivityType, isValidActivityType } from '../../interfaces/activity.interface';
import { validateActivity, normalizeActivity } from '../../utils/activity.utils';
import { BASE_POINTS, AI_POINT_MODIFIER } from '../../constants/activity.constants';

interface RetryConfiguration {
    maxAttempts: number;
    backoffMs: number;
    timeout: number;
}

/**
 * Enterprise-grade service for managing Azure DevOps activities
 * Implements comprehensive activity tracking with enhanced security and monitoring
 */
@Injectable()
export class ActivityService {
    private readonly retryConfig: RetryConfiguration = {
        maxAttempts: 3,
        backoffMs: 1000,
        timeout: 5000 // 5 second timeout for real-time requirement
    };

    constructor(
        private readonly activityRepository: ActivityRepository,
        private readonly aiDetectionService: AiDetectionService,
        private readonly queueService: QueueService,
        private readonly logger: Logger
    ) {
        this.logger.setContext('ActivityService');
    }

    /**
     * Creates and processes a new activity with enhanced security and monitoring
     * @param activityData Activity data to be processed
     * @returns Processed activity with points and AI detection
     */
    async createActivity(activityData: IActivity): Promise<IActivity> {
        const correlationId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.logger.setCorrelationId(correlationId);

        try {
            // Normalize and validate input data
            const normalizedActivity = normalizeActivity(activityData);
            await validateActivity(normalizedActivity);

            // Detect AI-generated code
            const isAiGenerated = await this.aiDetectionService.detectAiGenerated(normalizedActivity);
            normalizedActivity.isAiGenerated = isAiGenerated;

            // Calculate points based on activity type and AI status
            const points = this.calculatePoints(
                normalizedActivity.type,
                isAiGenerated,
                normalizedActivity.metadata.complexity
            );
            normalizedActivity.points = points;

            // Add activity to processing queue
            await this.queueService.addActivityToQueue(
                normalizedActivity,
                5, // Medium priority
                normalizedActivity.tenantId
            );

            // Create activity record
            const savedActivity = await this.activityRepository.createActivity(normalizedActivity);

            this.logger.info('Activity created successfully', {
                activityId: savedActivity.id,
                type: savedActivity.type,
                points: savedActivity.points,
                isAiGenerated: savedActivity.isAiGenerated,
                correlationId
            });

            return savedActivity;

        } catch (error) {
            this.logger.error('Failed to create activity', error, {
                correlationId,
                activityData
            });
            throw error;
        }
    }

    /**
     * Retrieves team member activities with enhanced filtering and pagination
     * @param teamMemberId Team member UUID
     * @param options Query options for pagination and filtering
     * @returns Paginated activities with metadata
     */
    async getTeamMemberActivities(
        teamMemberId: string,
        options: {
            skip?: number;
            take?: number;
            startDate?: Date;
            endDate?: Date;
        } = {}
    ): Promise<{ activities: IActivity[]; total: number }> {
        try {
            const activities = await this.activityRepository.findByTeamMember(
                teamMemberId,
                options
            );

            const total = activities.length;

            this.logger.debug('Retrieved team member activities', {
                teamMemberId,
                total,
                options
            });

            return { activities, total };

        } catch (error) {
            this.logger.error('Failed to retrieve team member activities', error, {
                teamMemberId,
                options
            });
            throw error;
        }
    }

    /**
     * Retrieves activities within date range with enhanced query optimization
     * @param startDate Start date for range query
     * @param endDate End date for range query
     * @returns Filtered activities within date range
     */
    async getActivitiesByDateRange(
        startDate: Date,
        endDate: Date,
        options: {
            skip?: number;
            take?: number;
        } = {}
    ): Promise<IActivity[]> {
        try {
            const activities = await this.activityRepository.findByDateRange(
                startDate,
                endDate
            );

            this.logger.debug('Retrieved activities by date range', {
                startDate,
                endDate,
                total: activities.length
            });

            return activities;

        } catch (error) {
            this.logger.error('Failed to retrieve activities by date range', error, {
                startDate,
                endDate
            });
            throw error;
        }
    }

    /**
     * Calculates points for an activity based on type, AI status, and complexity
     * @param type Activity type
     * @param isAiGenerated Whether activity contains AI-generated code
     * @param complexity Activity complexity score
     * @returns Calculated points value
     */
    private calculatePoints(
        type: ActivityType,
        isAiGenerated: boolean,
        complexity: number = 1
    ): number {
        if (!isValidActivityType(type)) {
            throw new Error(`Invalid activity type: ${type}`);
        }

        let points = BASE_POINTS[type];

        // Apply AI modifier if applicable
        if (isAiGenerated) {
            points *= AI_POINT_MODIFIER.MULTIPLIER;
        }

        // Apply complexity modifier (1-20% bonus)
        const complexityModifier = 1 + (Math.min(complexity, 10) / 50);
        points *= complexityModifier;

        // Round to nearest integer
        return Math.round(points);
    }
}