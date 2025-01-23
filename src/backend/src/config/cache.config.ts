// ioredis v5.3.0
import { RedisOptions } from 'ioredis';
// @nestjs/config v10.0.0
import { ConfigService } from '@nestjs/config';
import { CacheConfig } from '../interfaces/config.interface';

// Default configuration values
const DEFAULT_REDIS_HOST = 'localhost';
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_CACHE_TTL = 3600;
const DEFAULT_KEY_PREFIX = 'codequest:';
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_CLUSTER_NODES = 3;
const COMPRESSION_THRESHOLD = 1024;

/**
 * Factory function to generate Redis cache configuration with advanced features
 * including clustering, monitoring, and intelligent caching policies
 * @param configService NestJS config service for environment variables
 * @returns Enhanced Redis cache configuration
 */
export const getCacheConfig = (configService: ConfigService): CacheConfig => {
  // Load environment variables with fallbacks
  const host = configService.get<string>('REDIS_HOST', DEFAULT_REDIS_HOST);
  const port = configService.get<number>('REDIS_PORT', DEFAULT_REDIS_PORT);
  const password = configService.get<string>('REDIS_PASSWORD', '');
  const ttl = configService.get<number>('REDIS_TTL', DEFAULT_CACHE_TTL);
  const keyPrefix = configService.get<string>('REDIS_KEY_PREFIX', DEFAULT_KEY_PREFIX);
  const clusterEnabled = configService.get<boolean>('REDIS_CLUSTER_ENABLED', false);

  // Base configuration
  const config: CacheConfig = {
    host,
    port,
    password,
    ttl,
    keyPrefix,
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: DEFAULT_RETRY_ATTEMPTS,
    showFriendlyErrorStack: process.env.NODE_ENV !== 'production',

    // Tenant isolation configuration
    tenantIsolation: {
      enabled: true,
      separator: '::'
    },

    // Retry strategy with exponential backoff
    retryStrategy: (times: number) => {
      if (times > DEFAULT_RETRY_ATTEMPTS) {
        return null; // Stop retrying after maximum attempts
      }
      return Math.min(times * DEFAULT_RETRY_DELAY, 5000);
    },

    // Advanced monitoring configuration
    monitoring: {
      metrics: true,
      events: true,
      commandTimeout: 5000,
      collectLatencyStats: true,
      sentinelRetryStrategy: (times: number) => Math.min(times * 100, 3000)
    },

    // Data compression for large values
    compression: {
      threshold: COMPRESSION_THRESHOLD,
      types: ['string', 'json'],
      encodingType: 'gzip'
    }
  };

  // Cluster configuration if enabled
  if (clusterEnabled) {
    const clusterNodes = Array.from({ length: DEFAULT_CLUSTER_NODES }, (_, i) => ({
      host: configService.get<string>(`REDIS_CLUSTER_NODE_${i}_HOST`, host),
      port: configService.get<number>(`REDIS_CLUSTER_NODE_${i}_PORT`, port + i)
    }));

    config.cluster = {
      nodes: clusterNodes,
      options: {
        clusterRetryStrategy: (times: number) => {
          if (times > DEFAULT_RETRY_ATTEMPTS) {
            return null;
          }
          return Math.min(times * DEFAULT_RETRY_DELAY, 5000);
        },
        enableReadyCheck: true,
        scaleReads: 'slave',
        redisOptions: {
          password,
          tls: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false
          } : undefined
        }
      }
    };
  }

  // Connection pool settings
  config.connectionName = 'codequest-cache';
  config.connectTimeout = 10000;
  config.disconnectTimeout = 5000;
  config.keepAlive = 30000;
  config.noDelay = true;

  // TLS configuration for production
  if (process.env.NODE_ENV === 'production') {
    config.tls = {
      rejectUnauthorized: false
    };
  }

  // Event handlers for monitoring
  config.reconnectOnError = (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // Auto reconnect on failover
    }
    return false;
  };

  return config;
};

/**
 * Export the cache configuration factory
 * This will be used by the cache module to initialize Redis connections
 */
export const cacheConfig = {
  inject: [ConfigService],
  useFactory: getCacheConfig
};