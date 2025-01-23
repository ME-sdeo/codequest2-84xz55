// @nestjs/websockets v10.0.0
import { WebSocketGateway, SubscribeMessage, WebSocketServer, ConnectedSocket, MessageBody } from '@nestjs/websockets';
// socket.io v4.7.0
import { Server, Socket } from 'socket.io';
// @nestjs/common v10.0.0
import { Injectable } from '@nestjs/common';
// Internal imports
import { CacheService } from '../../services/cache.service';
import { QueueService } from '../../services/queue.service';
import { LoggerService } from '../../services/logger.service';

// Constants for WebSocket configuration
const TENANT_ROOM_PREFIX = 'tenant:';
const RATE_LIMIT_CONFIG = { points: 1000, duration: 60 };
const CIRCUIT_BREAKER_CONFIG = { failureThreshold: 5, resetTimeout: 60000 };
const SOCKET_EVENTS = {
  ACTIVITY_UPDATE: 'activity.update',
  POINTS_UPDATE: 'points.update',
  HEALTH_CHECK: 'health.check'
};

// Interfaces
interface TenantConnection {
  socketIds: Set<string>;
  rateLimitCounter: number;
  lastReset: number;
}

interface ActivityData {
  id: string;
  type: string;
  points: number;
  userId: string;
  metadata: Record<string, any>;
}

@WebSocketGateway({
  cors: true,
  namespace: '/events',
  transports: ['websocket'],
  maxHttpBufferSize: 1e6
})
@Injectable()
export class WebSocketGateway {
  @WebSocketServer() private readonly server: Server;
  private readonly tenantConnections: Map<string, TenantConnection> = new Map();
  private readonly circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false
  };

  constructor(
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
    private readonly logger: LoggerService
  ) {
    this.setupErrorHandling();
    this.startHealthCheck();
  }

  private setupErrorHandling(): void {
    this.server?.on('error', (error: Error) => {
      this.logger.error('WebSocket server error', error, { service: 'WebSocketGateway' });
    });
  }

  private startHealthCheck(): void {
    setInterval(() => {
      this.server?.emit(SOCKET_EVENTS.HEALTH_CHECK, { timestamp: Date.now() });
    }, 30000);
  }

  private async validateToken(token: string): Promise<{ tenantId: string; userId: string } | null> {
    try {
      // Implement token validation logic
      const decoded = { tenantId: '', userId: '' }; // Replace with actual JWT verification
      return decoded;
    } catch (error) {
      this.logger.error('Token validation failed', error as Error, { token });
      return null;
    }
  }

  private checkRateLimit(tenantId: string): boolean {
    const connection = this.tenantConnections.get(tenantId);
    if (!connection) return true;

    const now = Date.now();
    if (now - connection.lastReset > RATE_LIMIT_CONFIG.duration * 1000) {
      connection.rateLimitCounter = 0;
      connection.lastReset = now;
    }

    return connection.rateLimitCounter < RATE_LIMIT_CONFIG.points;
  }

  private updateCircuitBreaker(error: Error): boolean {
    const now = Date.now();
    if (now - this.circuitBreaker.lastFailure > CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      this.circuitBreaker.failures = 0;
    }

    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = now;

    if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      this.circuitBreaker.isOpen = true;
      this.logger.error('Circuit breaker opened', error, { service: 'WebSocketGateway' });
      return true;
    }
    return false;
  }

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth.token;
      const validated = await this.validateToken(token);

      if (!validated) {
        this.logger.warn('Invalid connection attempt', { clientId: client.id });
        client.disconnect(true);
        return;
      }

      const { tenantId, userId } = validated;
      this.logger.setTenantId(tenantId);

      // Initialize or update tenant connection tracking
      if (!this.tenantConnections.has(tenantId)) {
        this.tenantConnections.set(tenantId, {
          socketIds: new Set(),
          rateLimitCounter: 0,
          lastReset: Date.now()
        });
      }

      const connection = this.tenantConnections.get(tenantId)!;
      connection.socketIds.add(client.id);

      // Join tenant-specific room
      client.join(`${TENANT_ROOM_PREFIX}${tenantId}`);

      this.logger.info('Client connected', {
        clientId: client.id,
        tenantId,
        userId,
        activeConnections: connection.socketIds.size
      });

      // Handle disconnection
      client.on('disconnect', () => {
        connection.socketIds.delete(client.id);
        if (connection.socketIds.size === 0) {
          this.tenantConnections.delete(tenantId);
        }
        this.logger.info('Client disconnected', {
          clientId: client.id,
          tenantId,
          remainingConnections: connection.socketIds.size
        });
      });

    } catch (error) {
      this.logger.error('Connection handling error', error as Error, { clientId: client.id });
      client.disconnect(true);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.ACTIVITY_UPDATE)
  async handleActivityUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ActivityData
  ): Promise<void> {
    try {
      const token = client.handshake.auth.token;
      const validated = await this.validateToken(token);

      if (!validated) {
        throw new Error('Invalid token');
      }

      const { tenantId } = validated;

      // Check rate limit
      if (!this.checkRateLimit(tenantId)) {
        throw new Error('Rate limit exceeded');
      }

      // Check circuit breaker
      if (this.circuitBreaker.isOpen) {
        throw new Error('Circuit breaker is open');
      }

      // Update rate limit counter
      const connection = this.tenantConnections.get(tenantId)!;
      connection.rateLimitCounter++;

      // Process activity through queue
      await this.queueService.addActivityToQueue(
        {
          ...data,
          tenantId,
          timestamp: new Date(),
          metadata: { socketId: client.id }
        },
        1, // High priority for real-time updates
        tenantId
      );

      // Broadcast to tenant room
      this.server.to(`${TENANT_ROOM_PREFIX}${tenantId}`).emit(SOCKET_EVENTS.POINTS_UPDATE, {
        userId: data.userId,
        points: data.points,
        type: data.type,
        timestamp: Date.now()
      });

      this.logger.info('Activity processed', {
        tenantId,
        activityId: data.id,
        type: data.type
      });

    } catch (error) {
      const isCircuitBroken = this.updateCircuitBreaker(error as Error);
      this.logger.error('Activity update failed', error as Error, {
        clientId: client.id,
        circuitBroken: isCircuitBroken
      });
      client.emit('error', { message: 'Activity processing failed' });
    }
  }
}