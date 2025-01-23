import { EntityRepository, Repository, Between, QueryRunner, In } from 'typeorm'; // ^0.3.0
import { Logger } from 'winston'; // ^3.8.0
import { Activity } from '../entities/activity.entity';
import { IActivity } from '../interfaces/activity.interface';
import { validateActivity } from '../utils/activity.utils';
import { CacheManager } from '../utils/cache.manager';

/**
 * Repository class for managing Activity entity database operations
 * Implements real-time activity tracking with support for AI detection and data retention
 */
@EntityRepository(Activity)
export class ActivityRepository extends Repository<Activity> {
    private readonly logger: Logger;
    private readonly cacheManager: CacheManager;
    private readonly RETENTION_MONTHS = 12;
    private readonly BATCH_SIZE = 1000;
    private readonly QUERY_TIMEOUT = 30000; // 30 seconds

    constructor() {
        super();
        // Initialize logger for activity tracking
        this.logger = new Logger({
            level: 'info',
            format: Logger.format.json(),
            transports: [
                new Logger.transports.Console(),
                new Logger.transports.File({ filename: 'activity-repository.log' })
            ]
        });

        // Initialize cache manager for real-time updates
        this.cacheManager = new CacheManager('activity');
    }

    /**
     * Creates a new activity record with real-time point calculation
     * @param activityData Activity data to be persisted
     * @returns Promise<Activity> Created activity entity
     */
    async createActivity(activityData: IActivity): Promise<Activity> {
        const queryRunner = this.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Validate activity data
            await validateActivity(activityData);

            // Create new activity entity
            const activity = new Activity({
                ...activityData,
                createdAt: new Date()
            });

            // Save activity with transaction
            const savedActivity = await queryRunner.manager.save(Activity, activity);

            // Update cache for real-time access
            await this.cacheManager.set(
                `activity:${savedActivity.id}`,
                savedActivity,
                60 * 60 // 1 hour cache
            );

            await queryRunner.commitTransaction();
            
            this.logger.info('Activity created successfully', {
                activityId: savedActivity.id,
                teamMemberId: savedActivity.teamMemberId,
                type: savedActivity.type
            });

            return savedActivity;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Failed to create activity', {
                error: error.message,
                activityData
            });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Finds activities for a team member with pagination and caching
     * @param teamMemberId Team member UUID
     * @param options Query options for pagination and filtering
     * @returns Promise<Activity[]> List of activities
     */
    async findByTeamMember(
        teamMemberId: string,
        options: {
            skip?: number;
            take?: number;
            startDate?: Date;
            endDate?: Date;
        } = {}
    ): Promise<Activity[]> {
        const cacheKey = `activities:team:${teamMemberId}:${JSON.stringify(options)}`;
        
        // Try to get from cache first
        const cached = await this.cacheManager.get<Activity[]>(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const query = this.createQueryBuilder('activity')
                .where('activity.teamMemberId = :teamMemberId', { teamMemberId })
                .orderBy('activity.createdAt', 'DESC');

            // Apply pagination
            if (options.skip) query.skip(options.skip);
            if (options.take) query.take(options.take);

            // Apply date filters
            if (options.startDate && options.endDate) {
                query.andWhere('activity.createdAt BETWEEN :startDate AND :endDate', {
                    startDate: options.startDate,
                    endDate: options.endDate
                });
            }

            const activities = await query
                .timeout(this.QUERY_TIMEOUT)
                .cache(true)
                .getMany();

            // Cache results
            await this.cacheManager.set(cacheKey, activities, 300); // 5 minutes cache

            return activities;
        } catch (error) {
            this.logger.error('Failed to fetch team member activities', {
                error: error.message,
                teamMemberId,
                options
            });
            throw error;
        }
    }

    /**
     * Finds activities within a date range with optimized querying
     * @param startDate Start date for range query
     * @param endDate End date for range query
     * @returns Promise<Activity[]> List of activities
     */
    async findByDateRange(startDate: Date, endDate: Date): Promise<Activity[]> {
        try {
            return await this.createQueryBuilder('activity')
                .where({
                    createdAt: Between(startDate, endDate)
                })
                .orderBy('activity.createdAt', 'DESC')
                .timeout(this.QUERY_TIMEOUT)
                .cache(true)
                .getMany();
        } catch (error) {
            this.logger.error('Failed to fetch activities by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw error;
        }
    }

    /**
     * Deletes activities older than retention period (12 months)
     * Implements batch deletion with transaction support
     * @returns Promise<void>
     */
    async deleteOldActivities(): Promise<void> {
        const queryRunner = this.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - this.RETENTION_MONTHS);

            // Get IDs of activities to delete
            const activitiesToDelete = await this.createQueryBuilder('activity')
                .select('activity.id')
                .where('activity.createdAt < :cutoffDate', { cutoffDate })
                .getMany();

            const activityIds = activitiesToDelete.map(activity => activity.id);

            // Delete in batches
            for (let i = 0; i < activityIds.length; i += this.BATCH_SIZE) {
                const batch = activityIds.slice(i, i + this.BATCH_SIZE);
                await queryRunner.manager.delete(Activity, { id: In(batch) });
                
                // Clear cache for deleted activities
                await Promise.all(
                    batch.map(id => this.cacheManager.del(`activity:${id}`))
                );
            }

            await queryRunner.commitTransaction();

            this.logger.info('Old activities deleted successfully', {
                deletedCount: activitiesToDelete.length,
                cutoffDate
            });
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Failed to delete old activities', {
                error: error.message
            });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}