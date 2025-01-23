// ioredis v5.3.0
import { Redis, Cluster, RedisOptions } from 'ioredis';
// @nestjs/common v10.0.0
import { Injectable, OnModuleDestroy } from '@nestjs/common';
// lz4-js v0.4.1
import { compress, decompress } from 'lz4-js';
// Internal imports
import { cacheConfig } from '../config/cache.config';
import { LoggerService } from './logger.service';

// Constants for cache operations
const DEFAULT_CACHE_TTL = 3600;
const CACHE_KEY_SEPARATOR = ':';
const REDIS_RECONNECT_DELAY = 1000;
const COMPRESSION_THRESHOLD = 1024;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const RATE_LIMIT_WINDOW = 60000;
const METRIC_REPORTING_INTERVAL = 5000;

// Interface definitions
interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  namespace?: string;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  latency: number[];
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redisClient: Redis | Cluster;
  private readonly circuitBreaker: CircuitBreakerState;
  private readonly metrics: CacheMetrics;
  private readonly compressionEnabled: boolean;

  constructor(private readonly logger: LoggerService) {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      latency: []
    };

    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      isOpen: false
    };

    this.compressionEnabled = cacheConfig.compression?.enabled ?? true;

    // Initialize Redis client with cluster support
    this.redisClient = this.initializeRedisClient();
    this.setupRedisEventHandlers();
    this.startMetricsReporting();
  }

  private initializeRedisClient(): Redis | Cluster {
    const options: RedisOptions = {
      host: cacheConfig.host,
      port: cacheConfig.port,
      password: cacheConfig.password,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * REDIS_RECONNECT_DELAY, 5000);
      }
    };

    if (cacheConfig.cluster?.nodes) {
      return new Cluster(cacheConfig.cluster.nodes, {
        redisOptions: options,
        scaleReads: 'slave',
        clusterRetryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * REDIS_RECONNECT_DELAY, 5000);
        }
      });
    }

    return new Redis(options);
  }

  private setupRedisEventHandlers(): void {
    this.redisClient.on('error', (error: Error) => {
      this.logger.error('Redis connection error', error, { service: 'CacheService' });
      this.updateCircuitBreaker();
    });

    this.redisClient.on('ready', () => {
      this.logger.info('Redis connection established', { service: 'CacheService' });
      this.resetCircuitBreaker();
    });
  }

  private startMetricsReporting(): void {
    setInterval(() => {
      const avgLatency = this.metrics.latency.length > 0
        ? this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length
        : 0;

      this.logger.metric('cache_metrics', {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        errors: this.metrics.errors,
        avgLatency,
        circuitBreakerStatus: this.circuitBreaker.isOpen ? 'open' : 'closed'
      });

      // Reset latency array after reporting
      this.metrics.latency = [];
    }, METRIC_REPORTING_INTERVAL);
  }

  private updateCircuitBreaker(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      this.logger.warn('Circuit breaker opened', { service: 'CacheService' });
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.logger.info('Circuit breaker reset', { service: 'CacheService' });
  }

  private generateKey(key: string, tenantId: string, namespace?: string): string {
    const parts = [tenantId];
    if (namespace) parts.push(namespace);
    parts.push(key);
    return parts.join(CACHE_KEY_SEPARATOR);
  }

  async set<T>(key: string, value: T, tenantId: string, options: CacheOptions = {}): Promise<void> {
    if (this.circuitBreaker.isOpen) {
      throw new Error('Cache circuit breaker is open');
    }

    const start = Date.now();
    try {
      const cacheKey = this.generateKey(key, tenantId, options.namespace);
      let valueToCache: string | Buffer = JSON.stringify(value);

      // Apply compression if enabled and value size exceeds threshold
      if (this.compressionEnabled && options.compress !== false && valueToCache.length > COMPRESSION_THRESHOLD) {
        valueToCache = compress(Buffer.from(valueToCache));
      }

      const ttl = options.ttl || DEFAULT_CACHE_TTL;
      await this.redisClient.set(cacheKey, valueToCache, 'EX', ttl);

      this.metrics.latency.push(Date.now() - start);
      this.logger.debug('Cache set successful', { key: cacheKey, size: valueToCache.length });
    } catch (error) {
      this.metrics.errors++;
      this.updateCircuitBreaker();
      this.logger.error('Cache set failed', error as Error, { key, tenantId });
      throw error;
    }
  }

  async get<T>(key: string, tenantId: string, options: CacheOptions = {}): Promise<T | null> {
    if (this.circuitBreaker.isOpen) {
      throw new Error('Cache circuit breaker is open');
    }

    const start = Date.now();
    try {
      const cacheKey = this.generateKey(key, tenantId, options.namespace);
      const cachedValue = await this.redisClient.get(cacheKey);

      if (!cachedValue) {
        this.metrics.misses++;
        return null;
      }

      let result: T;
      
      // Handle compressed values
      if (this.compressionEnabled && options.compress !== false && cachedValue instanceof Buffer) {
        const decompressed = decompress(cachedValue);
        result = JSON.parse(decompressed.toString());
      } else {
        result = JSON.parse(cachedValue);
      }

      this.metrics.hits++;
      this.metrics.latency.push(Date.now() - start);
      return result;
    } catch (error) {
      this.metrics.errors++;
      this.updateCircuitBreaker();
      this.logger.error('Cache get failed', error as Error, { key, tenantId });
      throw error;
    }
  }

  async delete(key: string, tenantId: string, namespace?: string): Promise<void> {
    try {
      const cacheKey = this.generateKey(key, tenantId, namespace);
      await this.redisClient.del(cacheKey);
      this.logger.debug('Cache delete successful', { key: cacheKey });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Cache delete failed', error as Error, { key, tenantId });
      throw error;
    }
  }

  async clearTenantCache(tenantId: string): Promise<void> {
    try {
      const pattern = this.generateKey('*', tenantId);
      const keys = await this.redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
      
      this.logger.info('Tenant cache cleared', { tenantId, keysCleared: keys.length });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Clear tenant cache failed', error as Error, { tenantId });
      throw error;
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
    this.logger.info('Cache service shutdown complete');
  }
}