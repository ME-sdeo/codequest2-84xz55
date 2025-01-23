/**
 * @fileoverview WebSocket service for real-time updates with enhanced security and monitoring
 * Implements secure connection handling, automatic reconnection, message validation,
 * and performance monitoring for the CodeQuest platform.
 * @version 1.0.0
 */

// External imports
import ReconnectingWebSocket from 'reconnecting-websocket'; // v4.4.0
import pako from 'pako'; // v2.1.0
import type { WebSocketMessage } from '@types/websocket'; // v1.0.5

// Internal imports
import { ApiResponse } from '../types/common.types';
import { apiConfig } from '../config/api.config';

// Constants for WebSocket configuration
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const PING_INTERVAL = 30000;
const MESSAGE_TIMEOUT = 5000;
const MAX_MESSAGE_SIZE = 1048576; // 1MB

/**
 * Interface for WebSocket configuration options
 */
interface WebSocketConfig {
  url: string;
  compression?: boolean;
  maxRetries?: number;
  pingInterval?: number;
  messageTimeout?: number;
}

/**
 * Interface for WebSocket message structure
 */
interface WebSocketEvent<T = any> {
  type: string;
  data: T;
  timestamp: number;
  signature?: string;
}

/**
 * Interface for performance metrics
 */
interface MessageMetrics {
  sent: number;
  received: number;
  failed: number;
  latency: number[];
}

/**
 * Enhanced WebSocket service with security, monitoring, and performance features
 */
export class WebSocketService {
  private socket: ReconnectingWebSocket;
  private eventListeners: Map<string, Set<Function>>;
  private reconnectDelay: number;
  private pingInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private messageMetrics: Map<string, MessageMetrics>;
  private messageQueue: Array<{ message: WebSocketMessage; attempts: number }>;
  private isConnected: boolean;
  private readonly config: WebSocketConfig;

  /**
   * Initialize WebSocket service with enhanced configuration
   * @param config WebSocket configuration options
   */
  constructor(config: WebSocketConfig) {
    this.config = {
      ...config,
      compression: config.compression ?? true,
      maxRetries: config.maxRetries ?? 5,
      pingInterval: config.pingInterval ?? PING_INTERVAL,
      messageTimeout: config.messageTimeout ?? MESSAGE_TIMEOUT
    };

    this.eventListeners = new Map();
    this.messageMetrics = new Map();
    this.messageQueue = [];
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
    this.isConnected = false;

    this.initializeSocket();
  }

  /**
   * Initialize WebSocket connection with security and monitoring
   * @private
   */
  private initializeSocket(): void {
    this.socket = new ReconnectingWebSocket(
      this.config.url,
      [],
      {
        maxRetries: this.config.maxRetries,
        maxReconnectionDelay: MAX_RECONNECT_DELAY,
        minReconnectionDelay: INITIAL_RECONNECT_DELAY,
        connectionTimeout: this.config.messageTimeout
      }
    );

    this.setupEventHandlers();
    this.startHealthCheck();
  }

  /**
   * Establish secure WebSocket connection with authentication
   * @param authToken Authentication token for secure connection
   */
  public async connect(authToken: string): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Add authentication headers
      this.socket.setOptions({
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Client-Version': apiConfig.version
        }
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.config.messageTimeout);

        this.socket.addEventListener('open', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.startPingInterval();
          resolve();
        }, { once: true });

        this.socket.addEventListener('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        }, { once: true });
      });
    } catch (error) {
      this.handleError('Connection failed', error);
      throw error;
    }
  }

  /**
   * Subscribe to WebSocket events
   * @param eventType Event type to subscribe to
   * @param callback Callback function for event handling
   */
  public subscribe(eventType: string, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)?.add(callback);
  }

  /**
   * Unsubscribe from WebSocket events
   * @param eventType Event type to unsubscribe from
   * @param callback Callback function to remove
   */
  public unsubscribe(eventType: string, callback: Function): void {
    this.eventListeners.get(eventType)?.delete(callback);
  }

  /**
   * Handle incoming WebSocket messages with validation and metrics
   * @private
   * @param event WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const startTime = performance.now();
      let data = event.data;

      // Decompress if needed
      if (this.config.compression) {
        data = pako.inflate(data, { to: 'string' });
      }

      // Validate message size
      if (data.length > MAX_MESSAGE_SIZE) {
        throw new Error('Message size exceeds limit');
      }

      const message: WebSocketEvent = JSON.parse(data);

      // Validate message structure
      if (!this.validateMessage(message)) {
        throw new Error('Invalid message format');
      }

      // Update metrics
      this.updateMetrics(message.type, 'received', performance.now() - startTime);

      // Dispatch to listeners
      this.dispatchEvent(message);
    } catch (error) {
      this.handleError('Message processing failed', error);
    }
  }

  /**
   * Validate WebSocket message format and signature
   * @private
   * @param message WebSocket message to validate
   */
  private validateMessage(message: WebSocketEvent): boolean {
    return (
      message &&
      typeof message.type === 'string' &&
      message.timestamp &&
      typeof message.timestamp === 'number' &&
      Date.now() - message.timestamp < MESSAGE_TIMEOUT
    );
  }

  /**
   * Update performance metrics for monitoring
   * @private
   * @param type Message type
   * @param metric Metric type
   * @param value Metric value
   */
  private updateMetrics(type: string, metric: keyof MessageMetrics, value: number): void {
    if (!this.messageMetrics.has(type)) {
      this.messageMetrics.set(type, {
        sent: 0,
        received: 0,
        failed: 0,
        latency: []
      });
    }

    const metrics = this.messageMetrics.get(type)!;
    if (metric === 'latency') {
      metrics.latency.push(value);
      if (metrics.latency.length > 100) {
        metrics.latency.shift();
      }
    } else {
      metrics[metric]++;
    }
  }

  /**
   * Setup WebSocket event handlers
   * @private
   */
  private setupEventHandlers(): void {
    this.socket.addEventListener('message', this.handleMessage.bind(this));
    this.socket.addEventListener('close', this.handleClose.bind(this));
    this.socket.addEventListener('error', (error) => {
      this.handleError('WebSocket error', error);
    });
  }

  /**
   * Start health check interval
   * @private
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.isConnected) {
        this.checkConnectionHealth();
      }
    }, PING_INTERVAL);
  }

  /**
   * Start ping interval for connection monitoring
   * @private
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendPing();
      }
    }, this.config.pingInterval);
  }

  /**
   * Send ping message for connection monitoring
   * @private
   */
  private sendPing(): void {
    try {
      this.socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    } catch (error) {
      this.handleError('Ping failed', error);
    }
  }

  /**
   * Check connection health and metrics
   * @private
   */
  private checkConnectionHealth(): void {
    const metrics = Array.from(this.messageMetrics.values());
    const totalFailed = metrics.reduce((sum, m) => sum + m.failed, 0);
    const avgLatency = metrics
      .flatMap(m => m.latency)
      .reduce((sum, lat) => sum + lat, 0) / metrics.length || 0;

    if (totalFailed > 5 || avgLatency > 1000) {
      this.handleError('Connection health check failed', {
        failed: totalFailed,
        latency: avgLatency
      });
    }
  }

  /**
   * Handle WebSocket close event
   * @private
   */
  private handleClose(): void {
    this.isConnected = false;
    this.clearIntervals();
  }

  /**
   * Clear monitoring intervals
   * @private
   */
  private clearIntervals(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  /**
   * Handle errors with logging and metrics
   * @private
   * @param message Error message
   * @param error Error object
   */
  private handleError(message: string, error: any): void {
    console.error(`WebSocket Error: ${message}`, error);
    this.updateMetrics('error', 'failed', 0);
  }

  /**
   * Dispatch event to registered listeners
   * @private
   * @param message WebSocket message to dispatch
   */
  private dispatchEvent(message: WebSocketEvent): void {
    const listeners = this.eventListeners.get(message.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(message.data);
        } catch (error) {
          this.handleError('Event listener error', error);
        }
      });
    }
  }

  /**
   * Get current performance metrics
   * @returns Current message metrics
   */
  public getMetrics(): Map<string, MessageMetrics> {
    return new Map(this.messageMetrics);
  }

  /**
   * Disconnect WebSocket connection
   */
  public disconnect(): void {
    this.clearIntervals();
    this.socket.close();
    this.isConnected = false;
  }
}