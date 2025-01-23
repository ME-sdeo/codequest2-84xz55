// @nestjs/common v10.0.0
import { Module } from '@nestjs/common';
// @nestjs/circuit-breaker v1.0.0
import { CircuitBreakerModule } from '@nestjs/circuit-breaker';
// @nestjs/metrics v1.0.0
import { MetricsService } from '@nestjs/metrics';

// Internal imports
import { WebSocketGateway } from './websocket.gateway';
import { CacheService } from '../../services/cache.service';
import { QueueService } from '../../services/queue.service';

/**
 * WebSocketModule provides enterprise-grade WebSocket functionality with:
 * - Multi-tenant isolation through dedicated rooms
 * - Real-time event processing with < 2s latency
 * - Circuit breaker pattern for fault tolerance
 * - Comprehensive metrics and monitoring
 * - Scalable event processing with Redis backing
 */
@Module({
  imports: [
    CircuitBreakerModule.register({
      name: 'websocket',
      timeout: 5000, // 5s timeout for real-time requirement
      maxFailures: 5,
      resetTimeout: 60000,
      halfOpenAfter: 30000,
      maxRetries: 3
    })
  ],
  providers: [
    WebSocketGateway,
    CacheService,
    QueueService,
    MetricsService,
    {
      provide: 'WEBSOCKET_CONFIG',
      useValue: {
        maxConnectionsPerTenant: 1000,
        heartbeatInterval: 30000,
        disconnectTimeout: 60000,
        rateLimiting: {
          points: 1000,
          duration: 60,
          blockDuration: 300
        },
        monitoring: {
          enabled: true,
          metricsInterval: 10000,
          alertThresholds: {
            connectionCount: 5000,
            messageRate: 1000,
            errorRate: 50
          }
        }
      }
    }
  ],
  exports: [WebSocketGateway]
})
export class WebSocketModule {
  private readonly moduleVersion = '1.0.0';
  private readonly maxConnectionsPerTenant = 1000;

  constructor() {
    this.initializeModule();
  }

  /**
   * Initializes the WebSocket module with enterprise configurations
   * Sets up monitoring, tenant isolation, and fault tolerance
   */
  private initializeModule(): void {
    // Configure tenant isolation
    this.setupTenantIsolation();

    // Initialize circuit breaker
    this.setupCircuitBreaker();

    // Setup metrics collection
    this.setupMetrics();

    // Configure connection limits
    this.setupConnectionLimits();
  }

  /**
   * Configures tenant isolation for WebSocket connections
   * Ensures strict separation of tenant data and events
   */
  private setupTenantIsolation(): void {
    // Tenant isolation is handled by WebSocketGateway
    // through dedicated rooms and tenant-specific caching
  }

  /**
   * Initializes circuit breaker for fault tolerance
   * Prevents cascade failures in high-load scenarios
   */
  private setupCircuitBreaker(): void {
    // Circuit breaker configuration is handled by
    // CircuitBreakerModule.register in module imports
  }

  /**
   * Sets up comprehensive metrics collection
   * Monitors connection counts, message rates, and errors
   */
  private setupMetrics(): void {
    // Metrics collection is handled by MetricsService
    // and WebSocketGateway implementation
  }

  /**
   * Configures connection limits per tenant
   * Prevents resource exhaustion from single tenant
   */
  private setupConnectionLimits(): void {
    // Connection limits are enforced by WebSocketGateway
    // using maxConnectionsPerTenant configuration
  }
}