import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CircuitBreaker } from 'opossum';
import { TenantConfig } from '../interfaces/tenant.interface';
import { CompanyRepository } from '../repositories/company.repository';
import { CacheService } from '../services/cache.service';

// Constants for tenant middleware
const TENANT_CACHE_TTL = 3600; // 1 hour cache TTL
const TENANT_HEADER_KEY = 'x-tenant-id';
const TENANT_CACHE_COMPRESSION_THRESHOLD = 1024; // 1KB compression threshold
const TENANT_RATE_LIMIT_WINDOW = 60000; // 1 minute rate limit window

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly tenantRateLimits: Map<string, { count: number; timestamp: number }>;

  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly cacheService: CacheService
  ) {
    // Initialize circuit breaker for database resilience
    this.circuitBreaker = new CircuitBreaker(
      async (tenantId: string) => this.companyRepository.findById(tenantId),
      {
        timeout: 5000, // 5 second timeout
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      }
    );

    this.tenantRateLimits = new Map();

    // Setup circuit breaker event handlers
    this.setupCircuitBreakerEvents();
  }

  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      console.error('Tenant circuit breaker opened - falling back to cache only');
    });

    this.circuitBreaker.on('halfOpen', () => {
      console.log('Tenant circuit breaker attempting reset');
    });

    this.circuitBreaker.on('close', () => {
      console.log('Tenant circuit breaker closed - resuming normal operation');
    });
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate and sanitize tenant header
      const tenantId = this.validateTenantHeader(req);
      if (!tenantId) {
        res.status(400).json({ message: 'Invalid or missing tenant ID' });
        return;
      }

      // Check rate limits for tenant
      if (!this.checkRateLimits(tenantId)) {
        res.status(429).json({ message: 'Rate limit exceeded' });
        return;
      }

      // Try to get tenant config from cache first
      let tenantConfig: TenantConfig | null = await this.cacheService.get(
        `tenant:${tenantId}`,
        tenantId,
        { compress: true }
      );

      // If not in cache, fetch from database using circuit breaker
      if (!tenantConfig) {
        try {
          const company = await this.circuitBreaker.fire(tenantId);
          if (!company) {
            res.status(404).json({ message: 'Tenant not found' });
            return;
          }

          // Validate subscription and access rights
          const isValid = await this.companyRepository.validateSubscription(tenantId);
          if (!isValid) {
            res.status(403).json({ message: 'Invalid or expired subscription' });
            return;
          }

          tenantConfig = {
            subscriptionTier: company.subscriptionTier,
            pointConfig: company.pointConfig,
            maxOrganizations: company.maxOrganizations,
            maxTeamsPerOrg: company.maxTeamsPerOrg,
            maxUsersPerTeam: company.maxUsersPerTeam,
          };

          // Cache tenant configuration with compression if size exceeds threshold
          const configString = JSON.stringify(tenantConfig);
          if (configString.length > TENANT_CACHE_COMPRESSION_THRESHOLD) {
            await this.cacheService.set(
              `tenant:${tenantId}`,
              tenantConfig,
              tenantId,
              { compress: true, ttl: TENANT_CACHE_TTL }
            );
          } else {
            await this.cacheService.set(
              `tenant:${tenantId}`,
              tenantConfig,
              tenantId,
              { ttl: TENANT_CACHE_TTL }
            );
          }
        } catch (error) {
          // Circuit breaker is open or error occurred
          res.status(503).json({ message: 'Service temporarily unavailable' });
          return;
        }
      }

      // Set tenant context in request
      req['tenant'] = {
        id: tenantId,
        config: tenantConfig,
        timestamp: new Date().toISOString(),
      };

      // Add tenant-specific response headers
      res.setHeader('x-tenant-tier', tenantConfig.subscriptionTier);
      res.setHeader('x-request-tenant', tenantId);

      next();
    } catch (error) {
      next(error);
    }
  }

  private validateTenantHeader(req: Request): string | null {
    const tenantId = req.header(TENANT_HEADER_KEY);
    
    if (!tenantId) {
      return null;
    }

    // Validate tenant ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      return null;
    }

    return tenantId;
  }

  private checkRateLimits(tenantId: string): boolean {
    const now = Date.now();
    const limit = this.tenantRateLimits.get(tenantId);

    if (!limit || (now - limit.timestamp) > TENANT_RATE_LIMIT_WINDOW) {
      // Reset or initialize rate limit
      this.tenantRateLimits.set(tenantId, {
        count: 1,
        timestamp: now,
      });
      return true;
    }

    // Increment count and check limit
    limit.count++;
    if (limit.count > 1000) { // 1000 requests per minute
      return false;
    }

    return true;
  }
}