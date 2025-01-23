import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { ConfigModule } from '@nestjs/config'; // ^10.0.0
import { BullModule } from '@nestjs/bull'; // ^10.0.0

// Controllers
import { ActivityController } from './activity.controller';

// Services
import { ActivityService } from './activity.service';
import { AiDetectionService } from '../../services/ai-detection.service';
import { QueueService } from '../../services/queue.service';
import { LoggerService } from '../../services/logger.service';

// Repositories
import { ActivityRepository } from '../../repositories/activity.repository';

// Constants
const QUEUE_NAME = 'activity-queue';
const MAX_RETRIES = 3;
const PROCESSING_TIMEOUT = 5000; // 5 seconds for real-time requirement

/**
 * Activity Module Configuration
 * Implements comprehensive activity tracking with real-time processing and AI detection
 */
@Module({
    imports: [
        // Configure TypeORM for activity persistence
        TypeOrmModule.forFeature([ActivityRepository]),

        // Configure activity-specific settings
        ConfigModule.forFeature(() => ({
            activity: {
                maxRetries: MAX_RETRIES,
                processingTimeout: PROCESSING_TIMEOUT,
                aiDetection: {
                    enabled: true,
                    confidenceThreshold: 0.8
                },
                queues: {
                    name: QUEUE_NAME,
                    priority: {
                        high: 1,
                        medium: 5,
                        low: 10
                    }
                }
            }
        })),

        // Configure Bull queue for real-time processing
        BullModule.registerQueue({
            name: QUEUE_NAME,
            defaultJobOptions: {
                attempts: MAX_RETRIES,
                removeOnComplete: true,
                timeout: PROCESSING_TIMEOUT,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                }
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD,
                enableReadyCheck: true,
                maxRetriesPerRequest: MAX_RETRIES
            },
            settings: {
                lockDuration: 30000,
                stalledInterval: 30000,
                maxStalledCount: 1
            }
        })
    ],
    controllers: [ActivityController],
    providers: [
        // Core services
        ActivityService,
        AiDetectionService,
        QueueService,
        LoggerService,

        // Repository provider with custom token
        {
            provide: 'ACTIVITY_REPOSITORY',
            useClass: ActivityRepository
        }
    ],
    exports: [
        // Export ActivityService for use in other modules
        ActivityService
    ]
})
export class ActivityModule {
    constructor(private readonly loggerService: LoggerService) {
        this.loggerService.setContext('ActivityModule');
        this.initializeModule();
    }

    /**
     * Initializes the activity module with required configurations
     * Sets up error handling and monitoring
     */
    private async initializeModule(): Promise<void> {
        try {
            this.loggerService.info('Initializing Activity Module', {
                queueName: QUEUE_NAME,
                maxRetries: MAX_RETRIES,
                timeout: PROCESSING_TIMEOUT
            });

            // Additional initialization logic can be added here
            // such as setting up event listeners or initializing caches

        } catch (error) {
            this.loggerService.error('Failed to initialize Activity Module', error as Error, {
                queueName: QUEUE_NAME
            });
            throw error;
        }
    }
}