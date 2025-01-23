/**
 * @fileoverview Enhanced authentication hook for managing user authentication state and operations
 * with comprehensive security features, SSO support, and token management.
 * @version 1.0.0
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, logout, refreshToken } from '../store/auth.slice';
import { validateToken } from '../utils/auth.utils';
import type { User, LoginCredentials } from '../types/auth.types';

// Constants for token management
const TOKEN_REFRESH_INTERVAL = 300000; // 5 minutes
const MAX_REFRESH_RETRIES = 3;
const REFRESH_BACKOFF_MULTIPLIER = 1.5;

/**
 * Enhanced authentication hook providing secure authentication state and operations
 * @returns Authentication state and methods with comprehensive security features
 */
export const useAuth = () => {
  const dispatch = useDispatch();

  // Memoized selectors for auth state
  const authState = useSelector((state: any) => state.auth);
  const {
    currentUser,
    accessToken,
    isAuthenticated,
    isLoading,
    error,
    tokenExpiry,
    requiresMfa,
    ssoToken
  } = authState;

  /**
   * Enhanced login handler with SSO support and security validations
   * @param credentials Login credentials with optional SSO token
   * @returns Promise resolving to login result
   */
  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    try {
      // Validate credentials
      if (!credentials.email || (!credentials.password && !credentials.ssoToken)) {
        throw new Error('Invalid credentials');
      }

      // Handle MFA if required
      if (requiresMfa && !credentials.mfaToken) {
        throw new Error('MFA token required');
      }

      const result = await dispatch(login(credentials)).unwrap();
      
      // Validate received token
      if (!validateToken(result.accessToken)) {
        throw new Error('Invalid token received');
      }

      return result;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [dispatch, requiresMfa]);

  /**
   * Enhanced SSO login handler with provider validation
   * @param provider SSO provider name
   * @param token SSO authentication token
   */
  const handleSSOLogin = useCallback(async (provider: string, token: string) => {
    try {
      const credentials: LoginCredentials = {
        email: '', // Will be extracted from SSO token
        password: '', // Not required for SSO
        ssoToken: token
      };

      return await handleLogin(credentials);
    } catch (error) {
      console.error('SSO login failed:', error);
      throw error;
    }
  }, [handleLogin]);

  /**
   * Secure logout handler with token cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      await dispatch(logout()).unwrap();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Enhanced token refresh with exponential backoff
   */
  const handleTokenRefresh = useCallback(async () => {
    try {
      if (!accessToken || !tokenExpiry) return;

      const result = await dispatch(refreshToken()).unwrap();
      return result;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }, [dispatch, accessToken, tokenExpiry]);

  // Setup token refresh interval with cleanup
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    let retryCount = 0;

    const setupRefreshInterval = () => {
      if (isAuthenticated && tokenExpiry) {
        const timeUntilExpiry = tokenExpiry - Date.now();
        const refreshTime = Math.max(0, timeUntilExpiry - TOKEN_REFRESH_INTERVAL);

        refreshInterval = setTimeout(async () => {
          try {
            await handleTokenRefresh();
            retryCount = 0;
            setupRefreshInterval();
          } catch (error) {
            retryCount++;
            if (retryCount < MAX_REFRESH_RETRIES) {
              const backoffTime = TOKEN_REFRESH_INTERVAL * 
                Math.pow(REFRESH_BACKOFF_MULTIPLIER, retryCount);
              setTimeout(setupRefreshInterval, backoffTime);
            } else {
              handleLogout();
            }
          }
        }, refreshTime);
      }
    };

    setupRefreshInterval();

    return () => {
      if (refreshInterval) {
        clearTimeout(refreshInterval);
      }
    };
  }, [isAuthenticated, tokenExpiry, handleTokenRefresh, handleLogout]);

  // Memoized auth context value
  const authContext = useMemo(() => ({
    user: currentUser as User | null,
    isAuthenticated,
    isLoading,
    error,
    requiresMfa,
    login: handleLogin,
    loginWithSSO: handleSSOLogin,
    logout: handleLogout,
    refreshToken: handleTokenRefresh
  }), [
    currentUser,
    isAuthenticated,
    isLoading,
    error,
    requiresMfa,
    handleLogin,
    handleSSOLogin,
    handleLogout,
    handleTokenRefresh
  ]);

  return authContext;
};

export type UseAuthReturn = ReturnType<typeof useAuth>;