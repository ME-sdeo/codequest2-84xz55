/**
 * @fileoverview Authentication API service for CodeQuest frontend application.
 * Implements secure authentication endpoints with JWT token management, SSO integration,
 * and comprehensive security features.
 * @version 1.0.0
 */

import axios from 'axios'; // v1.4.0
import { 
  User, 
  LoginCredentials, 
  AuthResponse 
} from '../types/auth.types';
import { 
  loginSchema, 
  registerSchema,
  validateLoginData,
  validateRegistrationData 
} from '../validation/auth.schema';
import { apiConfig } from '../config/api.config';
import { sanitizeInput } from '../utils/validation.utils';

/**
 * Authentication endpoints configuration
 */
const AUTH_ENDPOINTS = {
  login: '/api/v1/auth/login',
  register: '/api/v1/auth/register',
  refresh: '/api/v1/auth/refresh',
  logout: '/api/v1/auth/logout',
  sso: '/api/v1/auth/sso'
} as const;

/**
 * Token configuration with expiry times
 */
const TOKEN_CONFIG = {
  accessTokenExpiry: 3600, // 1 hour
  refreshTokenExpiry: 604800, // 7 days
  autoRefreshThreshold: 300 // 5 minutes before expiry
} as const;

// Create axios instance with enhanced security configuration
const authApi = axios.create({
  ...apiConfig,
  withCredentials: true,
  headers: {
    ...apiConfig.headers,
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
  }
});

/**
 * Authenticates user with email/password credentials
 * @param credentials User login credentials
 * @returns Authentication response with user data and tokens
 * @throws ValidationError if credentials are invalid
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // Validate credentials
  const validationResult = validateLoginData(credentials);
  if (!validationResult.success) {
    throw new Error(validationResult.errors?.[0]?.message || 'Invalid credentials');
  }

  // Sanitize inputs
  const sanitizedCredentials = {
    email: sanitizeInput(credentials.email),
    password: credentials.password // Don't sanitize password
  };

  try {
    const response = await authApi.post<AuthResponse>(
      AUTH_ENDPOINTS.login,
      sanitizedCredentials
    );

    // Setup automatic token refresh
    setupTokenRefresh(response.data.expiresIn);

    return response.data;
  } catch (error) {
    throw handleAuthError(error);
  }
};

/**
 * Registers new user with enhanced validation
 * @param registrationData User registration data
 * @returns Authentication response for new user
 * @throws ValidationError if registration data is invalid
 */
export const register = async (registrationData: {
  email: string;
  password: string;
  role: string;
  companyId?: string;
  organizationId?: string;
}): Promise<AuthResponse> => {
  // Validate registration data
  const validationResult = validateRegistrationData(registrationData);
  if (!validationResult.success) {
    throw new Error(validationResult.errors?.[0]?.message || 'Invalid registration data');
  }

  try {
    const response = await authApi.post<AuthResponse>(
      AUTH_ENDPOINTS.register,
      registrationData
    );

    // Setup automatic token refresh
    setupTokenRefresh(response.data.expiresIn);

    return response.data;
  } catch (error) {
    throw handleAuthError(error);
  }
};

/**
 * Refreshes access token with automatic retry
 * @returns New access token with expiry
 */
export const refreshToken = async (): Promise<{ 
  accessToken: string; 
  expiresIn: number; 
}> => {
  try {
    const response = await authApi.post(AUTH_ENDPOINTS.refresh);
    return response.data;
  } catch (error) {
    throw handleAuthError(error);
  }
};

/**
 * Initiates SSO authentication flow
 * @param provider SSO provider identifier
 * @param options Additional SSO options
 * @returns SSO redirect URL with state
 */
export const initiateSSO = async (
  provider: string,
  options?: { redirectUri?: string; state?: string }
): Promise<{ redirectUrl: string; state: string }> => {
  try {
    const response = await authApi.get(
      `${AUTH_ENDPOINTS.sso}/${provider}/initiate`,
      { params: options }
    );
    return response.data;
  } catch (error) {
    throw handleAuthError(error);
  }
};

/**
 * Handles SSO callback with state validation
 * @param provider SSO provider identifier
 * @param params Callback parameters
 * @returns Authentication response from SSO
 */
export const handleSSOCallback = async (
  provider: string,
  params: Record<string, string>
): Promise<AuthResponse> => {
  try {
    const response = await authApi.post(
      `${AUTH_ENDPOINTS.sso}/${provider}/callback`,
      params
    );

    // Setup automatic token refresh
    setupTokenRefresh(response.data.expiresIn);

    return response.data;
  } catch (error) {
    throw handleAuthError(error);
  }
};

/**
 * Sets up automatic token refresh before expiry
 * @param expiresIn Token expiry time in seconds
 */
const setupTokenRefresh = (expiresIn: number): void => {
  const refreshTime = (expiresIn - TOKEN_CONFIG.autoRefreshThreshold) * 1000;
  setTimeout(async () => {
    try {
      const { accessToken, expiresIn: newExpiresIn } = await refreshToken();
      // Update token in storage/state
      setupTokenRefresh(newExpiresIn);
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Handle refresh failure (e.g., redirect to login)
    }
  }, refreshTime);
};

/**
 * Handles authentication errors with proper error messages
 * @param error Error object from API call
 * @returns Formatted error object
 */
const handleAuthError = (error: any): Error => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message || 'Authentication failed';
    return new Error(message);
  }
  return error;
};

// Add request interceptor for token management
authApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { accessToken } = await refreshToken();
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return authApi(originalRequest);
      } catch (refreshError) {
        // Handle refresh token failure
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);