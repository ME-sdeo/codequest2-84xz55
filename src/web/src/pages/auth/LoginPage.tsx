/**
 * @fileoverview Enhanced login page component with comprehensive security features,
 * SSO integration, and accessibility support following Material Design principles.
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import AuthLayout from '../../layouts/AuthLayout';
import LoginForm from '../../components/auth/LoginForm';
import SSOButtons from '../../components/auth/SSOButtons';
import { useAuth } from '../../hooks/useAuth';
import useAnalytics from '../../hooks/useAnalytics';

// Constants for rate limiting and security
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 300000; // 5 minutes
const ANALYTICS_EVENT = 'LOGIN_ATTEMPT';

/**
 * Enhanced login page component with security features and SSO integration
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { isAuthenticated, isLoading, loginError } = useAuth();

  // Local state for security tracking
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');

  /**
   * Initialize CSRF token on component mount
   */
  useEffect(() => {
    const generateCsrfToken = () => {
      const token = crypto.randomUUID();
      setCsrfToken(token);
      return token;
    };

    generateCsrfToken();
  }, []);

  /**
   * Redirect to dashboard if already authenticated
   */
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  /**
   * Clean up sensitive data on unmount
   */
  useEffect(() => {
    return () => {
      setCsrfToken('');
      setLoginAttempts(0);
      setLockoutUntil(null);
    };
  }, []);

  /**
   * Handle successful login with security checks
   */
  const handleLoginSuccess = useCallback(async () => {
    try {
      trackEvent(ANALYTICS_EVENT, { success: true });
      setLoginAttempts(0);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login success handler failed:', error);
      handleLoginError(error);
    }
  }, [navigate, trackEvent]);

  /**
   * Handle login error with rate limiting
   */
  const handleLoginError = useCallback((error: Error) => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      setLockoutUntil(Date.now() + LOCKOUT_DURATION);
    }

    trackEvent(ANALYTICS_EVENT, {
      success: false,
      error: error.message,
      attempts: newAttempts
    });
  }, [loginAttempts, trackEvent]);

  /**
   * Handle SSO authentication
   */
  const handleSSOLogin = useCallback(async (provider: string, token: string) => {
    try {
      trackEvent('SSO_LOGIN_ATTEMPT', { provider });
      // SSO login logic will be handled by LoginForm component
    } catch (error) {
      console.error('SSO login failed:', error);
      handleLoginError(error instanceof Error ? error : new Error('SSO login failed'));
    }
  }, [trackEvent, handleLoginError]);

  /**
   * Error boundary fallback component
   */
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        setLoginAttempts(0);
        setLockoutUntil(null);
      }}
    >
      <AuthLayout
        variant="login"
        className="login-page"
      >
        <div className="login-container">
          {/* Login form with security features */}
          <LoginForm
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            disabled={!!lockoutUntil || isLoading}
          />

          {/* Rate limit warning */}
          {loginAttempts > 0 && (
            <div
              className="rate-limit-warning"
              role="alert"
              aria-live="polite"
            >
              {`${MAX_LOGIN_ATTEMPTS - loginAttempts} attempts remaining`}
            </div>
          )}

          {/* Lockout message */}
          {lockoutUntil && (
            <div
              className="lockout-message"
              role="alert"
              aria-live="assertive"
            >
              Account locked. Please try again in{' '}
              {Math.ceil((lockoutUntil - Date.now()) / 1000 / 60)} minutes
            </div>
          )}

          {/* Error message */}
          {loginError && (
            <div
              className="error-message"
              role="alert"
              aria-live="assertive"
            >
              {loginError}
            </div>
          )}

          {/* SSO authentication section */}
          <div className="sso-section">
            <SSOButtons
              onSuccess={handleSSOLogin}
              onError={handleLoginError}
              nonce={csrfToken}
              loadingStates={{}}
            />
          </div>
        </div>
      </AuthLayout>
    </ErrorBoundary>
  );
};

export default LoginPage;