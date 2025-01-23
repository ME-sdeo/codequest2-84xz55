/**
 * @fileoverview Authentication and authorization type definitions for CodeQuest frontend.
 * Provides comprehensive type safety for user authentication, SSO integration, and RBAC.
 * @version 1.0.0
 */

import { BaseEntity, Role, TenantEntity } from '../types/common.types';

/**
 * Interface representing a user in the system with tenant isolation and SSO support.
 * Extends BaseEntity for audit fields and TenantEntity for multi-tenant isolation.
 */
export interface User extends BaseEntity, TenantEntity {
  /** User's email address used for authentication */
  email: string;
  /** User's assigned role for RBAC */
  role: Role;
  /** SSO-specific data including provider information and external IDs */
  ssoData: {
    provider?: string;
    externalId?: string;
    lastSync?: Date;
    metadata?: Record<string, unknown>;
  };
  /** Flag indicating if the user account is active */
  isActive: boolean;
  /** Timestamp of user's last successful login */
  lastLoginAt: Date;
  /** Computed list of user permissions based on role */
  readonly permissions: string[];
  /** Current session identifier for the user */
  readonly sessionId: string;
}

/**
 * Interface for user login credentials with strict validation requirements.
 * Supports both traditional and SSO-based authentication flows.
 */
export interface LoginCredentials {
  /** User's email address */
  email: string;
  /** User's password (required for non-SSO login) */
  password: string;
  /** Optional MFA token for two-factor authentication */
  mfaToken?: string;
  /** Optional SSO token for SSO-based authentication */
  ssoToken?: string;
}

/**
 * Interface for authentication state management with security considerations.
 * Maintains current user session and authentication status.
 */
export interface AuthState {
  /** Currently authenticated user or null if not authenticated */
  currentUser: User | null;
  /** Current JWT access token or null if not authenticated */
  accessToken: string | null;
  /** Flag indicating if user is authenticated */
  isAuthenticated: boolean;
  /** Flag indicating if authentication is in progress */
  isLoading: boolean;
  /** Authentication error message if any */
  error: string | null;
  /** Flag indicating if MFA is required */
  requiresMfa: boolean;
  /** Expiration timestamp for the current access token */
  tokenExpiry: Date | null;
}

/**
 * Interface for SSO provider configuration supporting multiple protocols.
 * Enables enterprise SSO integration with various identity providers.
 */
export interface SSOProvider {
  /** Display name of the SSO provider */
  name: string;
  /** Authentication endpoint URL */
  url: string;
  /** Provider icon URL for UI display */
  icon: string;
  /** Flag indicating if the provider is enabled */
  isEnabled: boolean;
  /** Authentication protocol (SAML, OAuth, OIDC) */
  protocol: string;
  /** Provider-specific configuration */
  config: {
    clientId?: string;
    tenantId?: string;
    scope?: string[];
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  };
  /** List of allowed email domains for this provider */
  allowedDomains: string[];
}

/**
 * Type for authentication response data with token management.
 * Contains all necessary data returned after successful authentication.
 */
export type AuthResponse = {
  /** Authenticated user data */
  user: User;
  /** JWT access token for API authorization */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Access token expiration timestamp */
  tokenExpiry: Date;
  /** API version for compatibility checking */
  version: string;
};

/**
 * Type for JWT token payload with claims and expiration.
 * Defines the structure of decoded JWT tokens.
 */
export type TokenPayload = {
  /** Subject identifier (user ID) */
  sub: string;
  /** User email */
  email: string;
  /** User role */
  role: Role;
  /** Optional company ID for tenant context */
  companyId?: string;
  /** Optional organization ID for tenant context */
  organizationId?: string;
  /** User permissions array */
  permissions: string[];
  /** Token expiration timestamp */
  exp: number;
  /** Token issued at timestamp */
  iat: number;
};