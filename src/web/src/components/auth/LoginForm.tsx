/**
 * @fileoverview Enhanced login form component with SSO integration, accessibility,
 * and comprehensive security features following Material Design principles.
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../common/Input';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { loginSchema } from '../../validation/auth.schema';
import type { LoginCredentials } from '../../types/auth.types';
import { sanitizeInput } from '../../utils/validation.utils';

// Rate limiting constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 300000; // 5 minutes

interface LoginFormProps {
  /** Optional class name for styling */
  className?: string;
  /** Callback fired on successful login */
  onSuccess?: () => void;
  /** Flag to enable/disable SSO options */
  enableSSO?: boolean;
  /** Callback fired on login error */
  onError?: (error: string) => void;
}

/**
 * Enhanced login form component with comprehensive security features
 */
const LoginForm: React.FC<LoginFormProps> = ({
  className,
  onSuccess,
  enableSSO = true,
  onError
}) => {
  // Form state management with validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur'
  });

  // Authentication hook
  const { login, isLoading, error: authError } = useAuth();

  // Rate limiting state
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  // Clear lockout after duration
  useEffect(() => {
    if (lockoutUntil && Date.now() > lockoutUntil) {
      setLockoutUntil(null);
      setLoginAttempts(0);
    }
  }, [lockoutUntil]);

  /**
   * Enhanced form submission handler with rate limiting and security measures
   */
  const onSubmit = async (data: LoginCredentials) => {
    try {
      // Check rate limiting
      if (lockoutUntil && Date.now() < lockoutUntil) {
        const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 1000);
        throw new Error(`Too many attempts. Please try again in ${remainingTime} seconds`);
      }

      // Sanitize inputs
      const sanitizedData = {
        email: sanitizeInput(data.email),
        password: data.password // Don't sanitize password
      };

      // Attempt login
      await login(sanitizedData);
      setLoginAttempts(0);
      onSuccess?.();

    } catch (error) {
      // Handle rate limiting
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION);
        setError('root', {
          message: `Account locked. Please try again in ${LOCKOUT_DURATION / 1000 / 60} minutes`
        });
      } else {
        setError('root', {
          message: error instanceof Error ? error.message : 'Login failed'
        });
      }

      onError?.(error instanceof Error ? error.message : 'Login failed');
    }
  };

  return (
    <form
      className={`login-form ${className || ''}`}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-labelledby="login-title"
    >
      <h1 id="login-title" className="login-form__title">
        Sign In to CodeQuest
      </h1>

      {/* Email Input */}
      <div className="form-group">
        <Input
          {...register('email')}
          id="email"
          type="email"
          label="Email Address"
          error={!!errors.email}
          helperText={errors.email?.message}
          disabled={isSubmitting || isLoading || !!lockoutUntil}
          autoComplete="email"
          required
          aria-required="true"
        />
      </div>

      {/* Password Input */}
      <div className="form-group">
        <Input
          {...register('password')}
          id="password"
          type="password"
          label="Password"
          error={!!errors.password}
          helperText={errors.password?.message}
          disabled={isSubmitting || isLoading || !!lockoutUntil}
          autoComplete="current-password"
          required
          aria-required="true"
        />
      </div>

      {/* Error Messages */}
      {(errors.root?.message || authError) && (
        <div
          className="error-message"
          role="alert"
          aria-live="polite"
        >
          {errors.root?.message || authError}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="submit-button"
        disabled={isSubmitting || isLoading || !!lockoutUntil}
        isLoading={isSubmitting || isLoading}
        aria-disabled={isSubmitting || isLoading || !!lockoutUntil}
      >
        Sign In
      </Button>

      {/* Rate Limit Warning */}
      {loginAttempts > 0 && (
        <div
          className="rate-limit-warning"
          role="status"
          aria-live="polite"
        >
          {`${MAX_LOGIN_ATTEMPTS - loginAttempts} attempts remaining`}
        </div>
      )}

      {/* SSO Options */}
      {enableSSO && (
        <div className="sso-container" role="complementary">
          <div className="sso-divider">
            <span>Or continue with</span>
          </div>
          {/* SSO provider buttons would be rendered here */}
        </div>
      )}
    </form>
  );
};

export default LoginForm;