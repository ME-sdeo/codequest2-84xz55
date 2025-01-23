/**
 * @fileoverview API configuration for CodeQuest frontend application
 * Defines API settings, security headers, monitoring, and retry policies
 * @version 1.0.0
 */

// External imports - axios v1.4.0
import type { AxiosRequestConfig, AxiosHeaders } from 'axios';

// Internal imports
import type { ApiResponse } from '../types/common.types';

// Global constants
const API_VERSION = 'v1';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const RESPONSE_TIME_SLA = 500;

/**
 * Enhanced interface defining available API configuration options
 * with security and monitoring features
 */
export interface ApiConfigOptions extends AxiosRequestConfig {
  baseURL: string;
  timeout: number;
  headers: AxiosHeaders;
  withCredentials: boolean;
  enforceHttps: boolean;
  retryConfig: RetryConfig;
  monitoringConfig: MonitoringConfig;
  securityConfig: SecurityConfig;
}

/**
 * Configuration for API retry behavior with exponential backoff
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}

/**
 * Configuration for API monitoring and SLA tracking
 */
export interface MonitoringConfig {
  enableMetrics: boolean;
  slaThreshold: number;
  logRequests: boolean;
}

/**
 * Enhanced security configuration with CSRF and header policies
 */
export interface SecurityConfig {
  enableCsrf: boolean;
  csrfHeaderName: string;
  securityHeaders: Record<string, string>;
}

/**
 * Production-ready API configuration with comprehensive security
 * and monitoring capabilities
 */
export const apiConfig: ApiConfigOptions = {
  baseURL: process.env.VITE_API_URL || 'http://localhost:3000',
  timeout: DEFAULT_TIMEOUT,
  enforceHttps: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  },
  withCredentials: true,
  retryConfig: {
    maxRetries: MAX_RETRIES,
    retryDelay: 1000,
    retryableStatuses: [408, 429, 500, 502, 503, 504]
  },
  monitoringConfig: {
    enableMetrics: true,
    slaThreshold: RESPONSE_TIME_SLA,
    logRequests: true
  },
  securityConfig: {
    enableCsrf: true,
    csrfHeaderName: 'X-CSRF-Token',
    securityHeaders: {
      'Content-Security-Policy': "default-src 'self'"
    }
  }
};

/**
 * API endpoints for all services with proper versioning
 * and tenant-aware paths
 */
export const endpoints = {
  activity: `/api/${API_VERSION}/activities`,
  analytics: `/api/${API_VERSION}/analytics`,
  auth: `/api/${API_VERSION}/auth`,
  company: `/api/${API_VERSION}/companies`,
  organization: `/api/${API_VERSION}/organizations`,
  points: `/api/${API_VERSION}/points`,
  team: `/api/${API_VERSION}/teams`,
  health: `/api/${API_VERSION}/health`,
  tenant: `/api/${API_VERSION}/tenant`
} as const;

/**
 * Type guard to ensure API response type safety
 * @param response The response to type check
 * @returns True if the response matches the ApiResponse interface
 */
export function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    'data' in response
  );
}

/**
 * Utility function to build tenant-aware API paths
 * @param basePath The base endpoint path
 * @param tenantId The tenant identifier
 * @returns The complete tenant-scoped path
 */
export function buildTenantPath(basePath: string, tenantId: string): string {
  return `${basePath}/${tenantId}`;
}