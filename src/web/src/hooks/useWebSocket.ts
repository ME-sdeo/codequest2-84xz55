/**
 * @fileoverview Custom React hook for managing WebSocket connections with enhanced reliability
 * Provides real-time updates for points, activities, and achievements with automatic reconnection
 * and comprehensive error handling.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react'; // v18.0.0
import { useSelector } from 'react-redux';
import { WebSocketService } from '../services/websocket.service';

// Constants for WebSocket management
const RECONNECT_ATTEMPTS = 5;
const HEALTH_CHECK_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 5000;

// Connection state enumeration
enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING'
}

// Interface for subscription options
interface SubscriptionOptions {
  retryAttempts?: number;
  timeout?: number;
  onError?: (error: Error) => void;
}

// WebSocket service instance
const wsService = new WebSocketService({
  url: `${process.env.VITE_WS_URL}/realtime`,
  compression: true,
  maxRetries: RECONNECT_ATTEMPTS,
  pingInterval: HEALTH_CHECK_INTERVAL,
  messageTimeout: CONNECTION_TIMEOUT
});

/**
 * Custom hook for managing WebSocket connections with automatic reconnection
 * and real-time updates for the CodeQuest platform.
 * 
 * @returns WebSocket connection management interface
 */
export const useWebSocket = () => {
  // Local state management
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isHealthy, setIsHealthy] = useState(true);

  // Get auth token and tenant info from Redux store
  const authToken = useSelector((state: any) => state.auth.accessToken);
  const companyId = useSelector((state: any) => state.auth.currentUser?.companyId);

  /**
   * Handles WebSocket connection with authentication
   */
  const connect = useCallback(async () => {
    if (!authToken || !companyId) {
      setLastError(new Error('Missing authentication or tenant information'));
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      await wsService.connect(authToken);
      setConnectionState(ConnectionState.CONNECTED);
      setLastError(null);
    } catch (error) {
      setConnectionState(ConnectionState.DISCONNECTED);
      setLastError(error as Error);
      throw error;
    }
  }, [authToken, companyId]);

  /**
   * Handles subscription to WebSocket events with validation and error handling
   */
  const subscribe = useCallback(async (
    eventType: string,
    callback: Function,
    options: SubscriptionOptions = {}
  ) => {
    if (!eventType || typeof callback !== 'function') {
      throw new Error('Invalid subscription parameters');
    }

    if (connectionState !== ConnectionState.CONNECTED) {
      throw new Error('WebSocket not connected');
    }

    try {
      // Add tenant context to subscription
      const tenantEvent = `${companyId}:${eventType}`;
      wsService.subscribe(tenantEvent, callback);

      // Setup subscription monitoring
      const timeout = setTimeout(() => {
        if (options.onError) {
          options.onError(new Error('Subscription timeout'));
        }
      }, options.timeout || CONNECTION_TIMEOUT);

      return () => {
        clearTimeout(timeout);
        wsService.unsubscribe(tenantEvent, callback);
      };
    } catch (error) {
      setLastError(error as Error);
      if (options.onError) {
        options.onError(error as Error);
      }
      throw error;
    }
  }, [connectionState, companyId]);

  /**
   * Handles unsubscription from WebSocket events with cleanup
   */
  const unsubscribe = useCallback((
    eventType: string,
    callback: Function
  ) => {
    if (!eventType || typeof callback !== 'function') {
      throw new Error('Invalid unsubscription parameters');
    }

    const tenantEvent = `${companyId}:${eventType}`;
    wsService.unsubscribe(tenantEvent, callback);
  }, [companyId]);

  /**
   * Initiates manual reconnection with exponential backoff
   */
  const reconnect = useCallback(async () => {
    setConnectionState(ConnectionState.RECONNECTING);
    try {
      await wsService.reconnect();
      setConnectionState(ConnectionState.CONNECTED);
      setLastError(null);
    } catch (error) {
      setConnectionState(ConnectionState.DISCONNECTED);
      setLastError(error as Error);
      throw error;
    }
  }, []);

  /**
   * Performs periodic health checks of the WebSocket connection
   */
  useEffect(() => {
    if (connectionState !== ConnectionState.CONNECTED) return;

    const healthCheck = setInterval(async () => {
      try {
        await wsService.checkHealth();
        setIsHealthy(true);
      } catch (error) {
        setIsHealthy(false);
        setLastError(error as Error);
        reconnect();
      }
    }, HEALTH_CHECK_INTERVAL);

    return () => clearInterval(healthCheck);
  }, [connectionState, reconnect]);

  /**
   * Manages WebSocket lifecycle and cleanup
   */
  useEffect(() => {
    if (authToken && companyId) {
      connect();
    }

    return () => {
      wsService.disconnect();
      setConnectionState(ConnectionState.DISCONNECTED);
    };
  }, [authToken, companyId, connect]);

  return {
    isConnected: connectionState === ConnectionState.CONNECTED,
    connectionState,
    subscribe,
    unsubscribe,
    reconnect,
    lastError,
    isHealthy
  };
};

export type { SubscriptionOptions };
export { ConnectionState };