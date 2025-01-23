import { QueueOptions } from 'bull'; // v4.10.0
import { config } from '@nestjs/config'; // v10.0.0
import { QueueConfig } from '../interfaces/config.interface';

// Default Redis connection settings
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_HOST = 'localhost';
const DEFAULT_PREFIX = 'codequest';

// Queue processing settings
const QUEUE_RETRY_ATTEMPTS = 3;
const QUEUE_BACKOFF_DELAY = 5000; // 5 seconds for real-time processing requirement
const QUEUE_REMOVE_ON_COMPLETE = true;
const QUEUE_REMOVE_ON_FAIL = false;

// Priority levels for different queues
const HIGH_PRIORITY = 1;
const MEDIUM_PRIORITY = 5;
const LOW_PRIORITY = 10;

/**
 * Factory function to generate comprehensive queue configuration
 * Implements multi-tenant, scalable queue system using Bull and Redis
 * @returns {QueueConfig} Complete queue configuration object
 */
export const getQueueConfig = (): QueueConfig => {
    const redisHost = process.env.REDIS_HOST || DEFAULT_REDIS_HOST;
    const redisPort = parseInt(process.env.REDIS_PORT || String(DEFAULT_REDIS_PORT), 10);
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisPrefix = process.env.REDIS_PREFIX || DEFAULT_PREFIX;

    // Base queue options with error handling and monitoring
    const baseQueueOptions: QueueOptions = {
        prefix: redisPrefix,
        defaultJobOptions: {
            attempts: QUEUE_RETRY_ATTEMPTS,
            backoff: {
                type: 'exponential',
                delay: QUEUE_BACKOFF_DELAY,
            },
            removeOnComplete: QUEUE_REMOVE_ON_COMPLETE,
            removeOnFail: QUEUE_REMOVE_ON_FAIL,
        },
        redis: {
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            tls: process.env.NODE_ENV === 'production' ? {
                rejectUnauthorized: false,
            } : undefined,
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            connectTimeout: 10000,
        },
        settings: {
            stalledInterval: 30000, // Check for stalled jobs every 30 seconds
            maxStalledCount: 2,
            lockDuration: 30000,
        },
    };

    // Queue-specific configurations
    const queueConfig: QueueConfig = {
        host: redisHost,
        port: redisPort,
        queues: {
            activities: 'activities',
            points: 'points',
            notifications: 'notifications',
        },
        options: {
            ...baseQueueOptions,
            limiter: {
                max: 1000, // Maximum jobs processed per time window
                duration: 5000, // Time window in milliseconds
            },
            metrics: {
                maxDataPoints: 100,
                collectInterval: 5000,
            },
        },
        monitoring: {
            metrics: true,
            events: true,
        },
    };

    // Queue-specific processors and concurrency settings
    const queueProcessors = {
        activities: {
            ...baseQueueOptions,
            priority: HIGH_PRIORITY,
            concurrency: 10, // Process multiple activities concurrently
            rate: {
                max: 100, // Maximum jobs per second
                duration: 1000,
            },
        },
        points: {
            ...baseQueueOptions,
            priority: MEDIUM_PRIORITY,
            concurrency: 5,
            rate: {
                max: 50,
                duration: 1000,
            },
        },
        notifications: {
            ...baseQueueOptions,
            priority: LOW_PRIORITY,
            concurrency: 3,
            rate: {
                max: 20,
                duration: 1000,
            },
        },
    };

    // Add processor configurations to queue options
    Object.entries(queueProcessors).forEach(([queueName, processorConfig]) => {
        queueConfig.options[queueName] = processorConfig;
    });

    return queueConfig;
};

// Export the configured queue settings
export const queueConfig = getQueueConfig();