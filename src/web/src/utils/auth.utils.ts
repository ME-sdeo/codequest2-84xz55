/**
 * @fileoverview Authentication utility functions for secure token management and RBAC
 * @version 1.0.0
 */

import jwtDecode from 'jwt-decode'; // v3.1.2
import { User, TokenPayload } from '../types/auth.types';
import { Role } from '../types/common.types';
import { setLocalStorage, getLocalStorage } from './storage.utils';

// Constants for token and storage management
const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes in seconds
const AUTH_STORAGE_KEY = 'auth';
const MAX_TOKEN_AGE = 3600; // 1 hour in seconds
const STORAGE_QUOTA = 5242880; // 5MB

/**
 * Securely parses and validates JWT token with comprehensive checks
 * @param token JWT token string
 * @param companyId Company ID for tenant validation
 * @returns Decoded and validated token payload or null if invalid
 */
export const parseToken = (token: string, companyId: string): TokenPayload | null => {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const decoded = jwtDecode<TokenPayload>(token);

    // Validate required claims
    if (!decoded.sub || !decoded.role || !decoded.exp) {
      return null;
    }

    // Validate tenant isolation
    if (decoded.companyId !== companyId) {
      return null;
    }

    // Validate token expiration
    if (Date.now() >= decoded.exp * 1000) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token parsing failed:', error);
    return null;
  }
};

/**
 * Checks if JWT token is expired with buffer time consideration
 * @param token JWT token string
 * @returns Boolean indicating if token is expired or close to expiry
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<TokenPayload>(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime >= (decoded.exp - TOKEN_EXPIRY_BUFFER);
  } catch {
    return true;
  }
};

/**
 * Performs role-based access control check with tenant context
 * @param user User object
 * @param requiredRoles Single role or array of roles required for access
 * @param companyId Company ID for tenant validation
 * @returns Boolean indicating if user has required role and correct tenant context
 */
export const hasRole = (
  user: User,
  requiredRoles: Role | Role[],
  companyId: string
): boolean => {
  if (!user || !user.role || user.companyId !== companyId) {
    return false;
  }

  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  // Super Admin has access to everything
  if (user.role === Role.SUPER_ADMIN) {
    return true;
  }

  return roles.includes(user.role);
};

/**
 * Securely stores encrypted authentication data with tenant isolation
 * @param user User object
 * @param token JWT token
 * @param companyId Company ID for tenant isolation
 */
export const storeAuthData = async (
  user: User,
  token: string,
  companyId: string
): Promise<void> => {
  try {
    if (!user || !token || !companyId) {
      throw new Error('Invalid authentication data');
    }

    // Validate token before storage
    const tokenPayload = parseToken(token, companyId);
    if (!tokenPayload) {
      throw new Error('Invalid token payload');
    }

    const authData = {
      user,
      token,
      companyId,
      lastUpdated: Date.now()
    };

    // Store with encryption enabled
    await setLocalStorage(AUTH_STORAGE_KEY, authData, {
      encrypt: true,
      expiresIn: MAX_TOKEN_AGE * 1000
    });
  } catch (error) {
    console.error('Failed to store auth data:', error);
    throw error;
  }
};

/**
 * Securely clears authentication data with tenant context
 * @param companyId Company ID for tenant context
 */
export const clearAuthData = async (companyId: string): Promise<void> => {
  try {
    // Verify current tenant context before clearing
    const currentAuth = await getLocalStorage<{
      companyId: string;
    }>(AUTH_STORAGE_KEY, { encrypt: true });

    if (currentAuth && currentAuth.companyId === companyId) {
      await setLocalStorage(AUTH_STORAGE_KEY, null, { encrypt: true });
    }
  } catch (error) {
    console.error('Failed to clear auth data:', error);
    throw error;
  }
};