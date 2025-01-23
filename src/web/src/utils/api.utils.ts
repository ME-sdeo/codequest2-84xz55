/**
 * @fileoverview Enhanced API utilities for CodeQuest frontend application
 * Provides secure, monitored, and tenant-aware API request handling
 * @version 1.0.0
 */

// External imports
import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios'; // v1.4.0

// Internal imports
import { apiConfig } from '../config/api.config';
import type { ApiResponse } from '../types/common.types';

// Global constants for API handling
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 30000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const ERROR_RESET_INTERVAL = 60000;

/**
 * Circuit breaker state tracking
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

/**
 * Creates an enhanced axios instance with security, monitoring, and circuit breaker pattern
 */
const createApiClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: apiConfig.baseURL,
    timeout: REQUEST_TIMEOUT,
    headers: {
      ...apiConfig.headers,
      ...apiConfig.securityConfig.securityHeaders,
    },
    withCredentials: true,
  });

  // Request interceptor for security and monitoring
  instance.interceptors.request.use(
    (config) => {
      if (circuitBreaker.isOpen) {
        throw new Error('Circuit breaker is open');
      }

      // Add correlation ID for request tracking
      config.headers['X-Correlation-ID'] = crypto.randomUUID();

      // Add timestamp for monitoring
      config.metadata = { startTime: Date.now() };

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling and monitoring
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Calculate response time
      const duration = Date.now() - (response.config.metadata?.startTime || 0);
      
      // Log if exceeding SLA
      if (duration > apiConfig.monitoringConfig.slaThreshold) {
        console.warn(`API call exceeded SLA: ${duration}ms`);
      }

      return response;
    },
    async (error: AxiosError) => {
      // Update circuit breaker state
      updateCircuitBreakerState();

      if (isRetryableError(error) && getRetryCount(error) < MAX_RETRIES) {
        return retryRequest(error);
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

/**
 * Enhanced error handling with monitoring and circuit breaker updates
 */
const handleApiError = (error: unknown): ApiResponse<null> => {
  const axiosError = error as AxiosError;
  const correlationId = axiosError.config?.headers?.['X-Correlation-ID'];

  // Log error with correlation ID
  console.error(`API Error [${correlationId}]:`, {
    status: axiosError.response?.status,
    message: axiosError.message,
    url: axiosError.config?.url,
  });

  // Format error response
  const errorResponse: ApiResponse<null> = {
    success: false,
    data: null,
    error: getErrorMessage(axiosError),
  };

  return errorResponse;
};

/**
 * Enhanced tenant header management with validation and security
 */
const setTenantHeaders = (companyId: string, organizationId: string): void => {
  // Validate tenant ID formats
  if (!isValidUUID(companyId) || !isValidUUID(organizationId)) {
    throw new Error('Invalid tenant ID format');
  }

  // Set secure tenant headers
  apiClient.defaults.headers.common['X-Company-ID'] = encodeURIComponent(companyId);
  apiClient.defaults.headers.common['X-Organization-ID'] = encodeURIComponent(organizationId);
  apiClient.defaults.headers.common['X-Tenant-Timestamp'] = Date.now().toString();
};

/**
 * Utility function to validate UUID format
 */
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Updates circuit breaker state based on failures
 */
const updateCircuitBreakerState = (): void => {
  const now = Date.now();
  
  if (now - circuitBreaker.lastFailure > ERROR_RESET_INTERVAL) {
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;
  }

  circuitBreaker.failures++;
  circuitBreaker.lastFailure = now;

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
    setTimeout(() => {
      circuitBreaker.isOpen = false;
      circuitBreaker.failures = 0;
    }, ERROR_RESET_INTERVAL);
  }
};

/**
 * Determines if an error is retryable
 */
const isRetryableError = (error: AxiosError): boolean => {
  return (
    !error.response ||
    apiConfig.retryConfig.retryableStatuses.includes(error.response.status)
  );
};

/**
 * Gets the current retry count for a request
 */
const getRetryCount = (error: AxiosError): number => {
  return (error.config?.metadata?.retryCount || 0) as number;
};

/**
 * Retries a failed request with exponential backoff
 */
const retryRequest = async (error: AxiosError) => {
  const config = error.config!;
  config.metadata = config.metadata || {};
  config.metadata.retryCount = (config.metadata.retryCount || 0) + 1;

  const delay = Math.pow(2, config.metadata.retryCount) * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  return axios(config);
};

/**
 * Extracts user-friendly error message from error object
 */
const getErrorMessage = (error: AxiosError): string => {
  if (error.response?.data && typeof error.response.data === 'object') {
    return (error.response.data as { message?: string }).message || error.message;
  }
  return error.message;
};

// Create and export the configured API client
export const apiClient = createApiClient();

// Export utility functions
export { handleApiError, setTenantHeaders };