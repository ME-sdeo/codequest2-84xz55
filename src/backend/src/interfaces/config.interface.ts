// @nestjs/common v10.0.0
import { CorsOptions } from '@nestjs/common';
// @nestjs/typeorm v10.0.0
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
// ioredis v5.3.0
import { RedisOptions } from 'ioredis';
// @nestjs/bull v10.0.0
import { QueueOptions } from '@nestjs/bull';

/**
 * Defines the possible environment types for the application
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Main application configuration interface defining core settings
 * for the CodeQuest backend service
 */
export interface AppConfig {
    /** HTTP port the application listens on */
    port: number;
    /** Current environment mode */
    environment: Environment;
    /** Global API route prefix */
    apiPrefix: string;
    /** CORS configuration settings */
    corsOptions: CorsOptions;
    /** Rate limiting configuration */
    rateLimitOptions: {
        ttl: number;
        limit: number;
    };
    /** Swagger API documentation settings */
    swagger: {
        enabled: boolean;
        title: string;
        description: string;
        version: string;
        path: string;
    };
    /** Application monitoring configuration */
    monitoring: {
        enabled: boolean;
        metrics: boolean;
        tracing: boolean;
        logging: {
            level: string;
            format: string;
        };
    };
    /** Security-related configuration */
    security: {
        jwtSecret: string;
        jwtExpiresIn: string;
        bcryptSaltRounds: number;
    };
}

/**
 * Database configuration interface with multi-tenant
 * and replication support
 */
export interface DatabaseConfig extends TypeOrmModuleOptions {
    /** Database type - PostgreSQL only */
    type: 'postgres';
    /** Database host */
    host: string;
    /** Database port */
    port: number;
    /** Database username */
    username: string;
    /** Database password */
    password: string;
    /** Database name */
    database: string;
    /** Database schema */
    schema: string;
    /** Auto-synchronize entities */
    synchronize: boolean;
    /** Entity paths */
    entities: string[];
    /** Migration paths */
    migrations: string[];
    /** Database replication configuration */
    replication: {
        master: {
            host: string;
            port: number;
            username: string;
            password: string;
        };
        slaves: Array<{
            host: string;
            port: number;
            username: string;
            password: string;
        }>;
    };
    /** SSL configuration */
    ssl: {
        rejectUnauthorized: boolean;
        ca?: string;
        key?: string;
        cert?: string;
    };
    /** Multi-tenant identifier column */
    tenantIdentifier: string;
}

/**
 * Redis cache configuration interface with clustering
 * and tenant isolation support
 */
export interface CacheConfig extends RedisOptions {
    /** Redis host */
    host: string;
    /** Redis port */
    port: number;
    /** Redis password */
    password: string;
    /** Default TTL for cached items */
    ttl: number;
    /** Redis cluster configuration */
    cluster: {
        nodes: Array<{
            host: string;
            port: number;
        }>;
        options: {
            clusterRetryStrategy: (times: number) => number;
        };
    };
    /** Key prefix for cache entries */
    keyPrefix: string;
    /** Multi-tenant isolation settings */
    tenantIsolation: {
        enabled: boolean;
        separator: string;
    };
}

/**
 * Message queue configuration interface with monitoring
 * and retry strategies
 */
export interface QueueConfig {
    /** Queue host */
    host: string;
    /** Queue port */
    port: number;
    /** Queue names for different services */
    queues: {
        points: string;
        activities: string;
        notifications: string;
    };
    /** Queue options with job configuration */
    options: QueueOptions & {
        prefix: string;
        defaultJobOptions: {
            attempts: number;
            backoff: {
                type: string;
                delay: number;
            };
            removeOnComplete: boolean;
        };
    };
    /** Queue monitoring settings */
    monitoring: {
        metrics: boolean;
        events: boolean;
    };
}