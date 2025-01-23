// @nestjs/config v10.0.0
import { config } from '@nestjs/config';
// @nestjs/common v10.0.0
import { CorsOptions } from '@nestjs/common';
import { AppConfig } from '../interfaces/config.interface';
import { databaseConfig } from './database.config';
import { cacheConfig } from './cache.config';
import { queueConfig } from './queue.config';

// Default configuration values
const DEFAULT_PORT = 3000;
const DEFAULT_API_PREFIX = '/api/v1';
const DEFAULT_RATE_LIMIT = 100;
const DEFAULT_RATE_TTL = 60;
const DEFAULT_CORS_MAX_AGE = 86400;
const DEFAULT_TIMEOUT = 5000;

/**
 * Factory function that generates the comprehensive application configuration
 * Implements all required system settings with security, performance, and monitoring
 * @returns {AppConfig} Complete application configuration object
 */
export const getAppConfig = (): AppConfig => {
    const environment = process.env.NODE_ENV || 'development';
    const isProduction = environment === 'production';

    // Base server configuration
    const serverConfig = {
        port: parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
        environment: environment as 'development' | 'production' | 'test',
        apiPrefix: process.env.API_PREFIX || DEFAULT_API_PREFIX,
    };

    // Enhanced security configuration with CSP and rate limiting
    const securityConfig = {
        corsOptions: {
            origin: isProduction ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
            credentials: true,
            maxAge: DEFAULT_CORS_MAX_AGE,
            preflightContinue: false,
        } as CorsOptions,
        rateLimitOptions: {
            ttl: parseInt(process.env.RATE_LIMIT_TTL || String(DEFAULT_RATE_TTL), 10),
            limit: parseInt(process.env.RATE_LIMIT || String(DEFAULT_RATE_LIMIT), 10),
        },
        helmet: {
            contentSecurityPolicy: isProduction,
            crossOriginEmbedderPolicy: isProduction,
            crossOriginOpenerPolicy: isProduction,
            crossOriginResourcePolicy: isProduction,
            dnsPrefetchControl: true,
            frameguard: true,
            hidePoweredBy: true,
            hsts: isProduction,
            ieNoOpen: true,
            noSniff: true,
            referrerPolicy: true,
            xssFilter: true,
        },
    };

    // Comprehensive monitoring configuration
    const monitoringConfig = {
        metrics: {
            enabled: true,
            collectInterval: 10000,
            prefix: 'codequest_',
            defaultLabels: {
                app: 'codequest',
                env: environment,
            },
        },
        tracing: {
            enabled: true,
            serviceName: 'codequest-backend',
            samplingRate: isProduction ? 0.1 : 1.0,
        },
        logging: {
            level: isProduction ? 'info' : 'debug',
            format: isProduction ? 'json' : 'pretty',
            timestamps: true,
            colors: !isProduction,
        },
        healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: DEFAULT_TIMEOUT,
            path: '/health',
        },
    };

    // API documentation configuration
    const swaggerConfig = {
        enabled: !isProduction,
        title: 'CodeQuest API',
        description: 'CodeQuest gamification platform API documentation',
        version: '1.0.0',
        path: 'docs',
        auth: {
            enabled: true,
            type: 'bearer',
        },
    };

    // Circuit breaker configuration for resilience
    const circuitBreakerConfig = {
        enabled: true,
        timeout: DEFAULT_TIMEOUT,
        resetTimeout: 30000,
        errorThresholdPercentage: 50,
        volumeThreshold: 10,
    };

    // Combine all configurations
    return {
        ...serverConfig,
        corsOptions: securityConfig.corsOptions,
        rateLimitOptions: securityConfig.rateLimitOptions,
        security: {
            ...securityConfig.helmet,
            jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
            bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
        },
        monitoring: monitoringConfig,
        swagger: swaggerConfig,
        circuitBreaker: circuitBreakerConfig,
        database: databaseConfig,
        cache: cacheConfig,
        queue: queueConfig,
    } as AppConfig;
};

/**
 * Export the configured application settings
 * This is the main configuration object used throughout the application
 */
export const appConfig = getAppConfig();