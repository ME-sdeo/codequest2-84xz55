/**
 * @fileoverview Registration page component implementing secure user registration with
 * SSO integration, form validation, and Material Design 3 principles.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.0.0
import { toast } from 'react-toastify'; // v9.0.0

import AuthLayout from '../../layouts/AuthLayout';
import RegisterForm from '../../components/auth/RegisterForm';
import SSOButtons from '../../components/auth/SSOButtons';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types/auth.types';

// Constants for rate limiting and security
const MAX_REGISTRATION_ATTEMPTS = 5;
const LOCKOUT_DURATION = 300000; // 5 minutes
const REGISTRATION_ATTEMPT_RESET = 3600000; // 1 hour

/**
 * Enhanced registration page component with comprehensive security features
 * and accessibility support following Material Design 3 principles.
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [registrationAttempts, setRegistrationAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [isRTL] = useState<boolean>(() => 
    document.documentElement.dir === 'rtl'
  );
  const [highContrast] = useState<boolean>(() => 
    window.matchMedia('(forced-colors: active)').matches
  );

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Reset registration attempts after duration
  useEffect(() => {
    const resetTimer = setTimeout(() => {
      setRegistrationAttempts(0);
    }, REGISTRATION_ATTEMPT_RESET);

    return () => clearTimeout(resetTimer);
  }, [registrationAttempts]);

  /**
   * Handles successful registration with analytics tracking
   * @param user - Registered user data
   */
  const handleRegistrationSuccess = useCallback((user: User) => {
    // Reset security counters
    setRegistrationAttempts(0);
    setLockoutUntil(null);

    // Track successful registration
    if (window.gtag) {
      window.gtag('event', 'registration_success', {
        method: user.ssoData?.provider ? 'sso' : 'email',
        user_role: user.role
      });
    }

    // Show success notification
    toast.success('Registration successful! Redirecting...', {
      position: isRTL ? 'top-left' : 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });

    // Redirect to dashboard
    navigate('/dashboard');
  }, [navigate, isRTL]);

  /**
   * Handles registration errors with rate limiting
   * @param error - Registration error
   */
  const handleRegistrationError = useCallback((error: Error) => {
    // Increment attempt counter
    const newAttempts = registrationAttempts + 1;
    setRegistrationAttempts(newAttempts);

    // Check rate limiting
    if (newAttempts >= MAX_REGISTRATION_ATTEMPTS) {
      const lockoutTime = Date.now() + LOCKOUT_DURATION;
      setLockoutUntil(lockoutTime);

      toast.error(
        `Too many attempts. Please try again in ${LOCKOUT_DURATION / 60000} minutes.`,
        {
          position: isRTL ? 'top-left' : 'top-right',
          autoClose: LOCKOUT_DURATION,
          closeButton: false,
          draggable: false,
        }
      );

      // Track lockout event
      if (window.gtag) {
        window.gtag('event', 'registration_lockout', {
          attempts: newAttempts
        });
      }
    } else {
      // Show error notification
      toast.error(error.message, {
        position: isRTL ? 'top-left' : 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });

      // Track error event
      if (window.gtag) {
        window.gtag('event', 'registration_error', {
          error_type: error.name,
          error_message: error.message
        });
      }
    }
  }, [registrationAttempts, isRTL]);

  /**
   * Handles SSO registration success
   * @param provider - SSO provider name
   * @param token - SSO authentication token
   */
  const handleSSOSuccess = useCallback((provider: string, token: string) => {
    // Track SSO success
    if (window.gtag) {
      window.gtag('event', 'sso_registration_success', {
        provider
      });
    }

    toast.success(`Successfully registered with ${provider}`, {
      position: isRTL ? 'top-left' : 'top-right',
      autoClose: 3000
    });
  }, [isRTL]);

  /**
   * Handles SSO registration errors
   * @param error - SSO error
   */
  const handleSSOError = useCallback((error: Error) => {
    // Track SSO error
    if (window.gtag) {
      window.gtag('event', 'sso_registration_error', {
        error_type: error.name,
        error_message: error.message
      });
    }

    toast.error(`SSO registration failed: ${error.message}`, {
      position: isRTL ? 'top-left' : 'top-right',
      autoClose: 5000
    });
  }, [isRTL]);

  // Generate secure nonce for CSRF protection
  const nonce = React.useMemo(() => crypto.randomUUID(), []);

  return (
    <AuthLayout
      variant="register"
      isRTL={isRTL}
      highContrast={highContrast}
      className="register-page"
    >
      <RegisterForm
        onSuccess={handleRegistrationSuccess}
        onError={handleRegistrationError}
        enableSSO={true}
        supportedSSOProviders={['azure-ad', 'okta', 'auth0']}
      />

      <SSOButtons
        className="register-page__sso-buttons"
        onSuccess={handleSSOSuccess}
        onError={handleSSOError}
        nonce={nonce}
        loadingStates={{}}
      />

      {/* Accessibility announcement for screen readers */}
      <div
        role="status"
        aria-live="polite"
        className="visually-hidden"
      >
        {lockoutUntil && `Registration locked until ${new Date(lockoutUntil).toLocaleTimeString()}`}
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;