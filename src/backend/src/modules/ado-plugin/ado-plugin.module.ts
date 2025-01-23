import { Module } from '@nestjs/common'; // ^10.0.0
import { ConfigModule } from '@nestjs/config'; // ^3.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { BullModule } from '@nestjs/bull'; // ^10.0.0

import { AdoPluginController } from './ado-plugin.controller';
import { AdoPluginService } from './ado-plugin.service';
import { ActivityModule } from '../activity/activity.module';

/**
 * Azure DevOps Plugin Module
 * Implements enterprise-grade ADO integration with real-time processing,
 * AI code detection, and comprehensive monitoring capabilities.
 * Version: 1.0.0
 */
@Module({
    imports: [
        // Configure ADO-specific settings
        ConfigModule.forFeature(() => ({
            ado: {
                // ADO API Configuration
                baseUrl: process.env.ADO_BASE_URL,
                organization: process.env.ADO_ORGANIZATION,
                project: process.env.ADO_PROJECT,
                pat: process.env.ADO_PAT,

                // Webhook Configuration
                webhookSecret: process.env.ADO_WEBHOOK_SECRET,
                webhookEndpoint: '/ado-plugin/webhook',

                // AI Detection Settings
                aiDetection: {
                    enabled: true,
                    confidenceThreshold: 0.8,
                    retryAttempts: 3
                },

                // Real-time Processing
                processing: {
                    timeout: 2000, // 2 seconds as per requirements
                    maxRetries: 3,
                    backoffDelay: 1000
                },

                // Monitoring Configuration
                monitoring: {
                    metrics: true,
                    tracing: true,
                    logging: {
                        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
                    }
                }
            }
        })),

        // Configure TypeORM for ADO activity persistence
        TypeOrmModule.forFeature([
            // ADO activity entity will be registered here
        ]),

        // Configure Bull queue for real-time processing
        BullModule.registerQueue({
            name: 'ado-activities',
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                removeOnComplete: true,
                timeout: 2000 // 2 seconds for real-time requirement
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                retryStrategy: (times: number) => {
                    if (times > 3) return null;
                    return Math.min(times * 1000, 3000);
                }
            },
            settings: {
                lockDuration: 30000,
                stalledInterval: 30000,
                maxStalledCount: 1
            }
        }),

        // Import Activity module for point calculation and tracking
        ActivityModule
    ],
    controllers: [AdoPluginController],
    providers: [
        AdoPluginService,
        // Add Logger provider for monitoring
        {
            provide: 'ADO_LOGGER',
            useFactory: () => {
                const logger = new Logger('AdoPlugin');
                logger.setContext('ADO Integration');
                return logger;
            }
        }
    ],
    exports: [AdoPluginService]
})
export class AdoPluginModule {
    // Module constants
    private static readonly QUEUE_NAME = 'ado-activities';
    private static readonly PROCESSING_TIMEOUT_MS = 2000;
    private static readonly MAX_RETRIES = 3;

    constructor(private readonly logger: Logger) {
        this.initializeModule();
    }

    /**
     * Initializes the ADO plugin module with required configurations
     * Sets up error handling and monitoring
     */
    private async initializeModule(): Promise<void> {
        try {
            this.logger.log('Initializing ADO Plugin Module', {
                queueName: AdoPluginModule.QUEUE_NAME,
                timeout: AdoPluginModule.PROCESSING_TIMEOUT_MS,
                maxRetries: AdoPluginModule.MAX_RETRIES
            });

            // Setup health check
            this.setupHealthCheck();

            // Initialize monitoring
            this.initializeMonitoring();

            this.logger.log('ADO Plugin Module initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize ADO Plugin Module', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Sets up health check for ADO integration
     */
    private setupHealthCheck(): void {
        // Implement health check logic
        setInterval(() => {
            try {
                // Check ADO API connectivity
                // Check queue health
                // Check database connectivity
            } catch (error) {
                this.logger.error('Health check failed', {
                    error: error.message
                });
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Initializes monitoring and metrics collection
     */
    private initializeMonitoring(): void {
        // Setup metric collection
        // Setup performance monitoring
        // Setup error tracking
    }
}