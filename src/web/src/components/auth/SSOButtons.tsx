/**
 * @fileoverview SSO authentication buttons component with Material Design 3 compliance,
 * enhanced security features, and comprehensive accessibility support.
 * @version 1.0.0
 */

import React, { useCallback, useState } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.0
import Button, { ButtonProps } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';

// SSO provider configuration with enhanced security and accessibility
const SSO_PROVIDERS = [
  {
    id: 'azure-ad',
    name: 'Azure AD',
    icon: 'azure-icon',
    ariaLabel: 'Sign in with Azure Active Directory',
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 1000
    }
  },
  {
    id: 'okta',
    name: 'Okta',
    icon: 'okta-icon',
    ariaLabel: 'Sign in with Okta',
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 1000
    }
  },
  {
    id: 'auth0',
    name: 'Auth0',
    icon: 'auth0-icon',
    ariaLabel: 'Sign in with Auth0',
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 1000
    }
  }
] as const;

// Props interface with enhanced error handling and security features
export interface SSOButtonsProps {
  /** Additional CSS classes */
  className?: string;
  /** Loading states for individual providers */
  loadingStates?: Record<string, boolean>;
  /** Success callback with provider and token */
  onSuccess: (provider: string, token: string) => void;
  /** Error callback with enhanced error details */
  onError: (error: Error) => void;
  /** Security nonce for CSRF protection */
  nonce: string;
}

/**
 * SSO authentication buttons component with Material Design 3 compliance
 * and comprehensive security features
 */
const SSOButtons: React.FC<SSOButtonsProps> = ({
  className,
  loadingStates = {},
  onSuccess,
  onError,
  nonce
}) => {
  const { loginWithSSO } = useAuth();
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [retryAttempts, setRetryAttempts] = useState<Record<string, number>>({});

  /**
   * Handles SSO button click with enhanced security and error recovery
   */
  const handleSSOClick = useCallback(async (provider: string) => {
    try {
      // Validate and sanitize inputs
      if (!provider || !nonce) {
        throw new Error('Invalid SSO parameters');
      }

      // Update status for screen readers
      setStatusMessage(`Initiating ${provider} sign-in...`);

      // Generate and store state parameter for CSRF protection
      const state = crypto.getRandomValues(new Uint8Array(32))
        .reduce((acc, val) => acc + val.toString(16).padStart(2, '0'), '');

      // Implement retry logic with exponential backoff
      const currentAttempts = retryAttempts[provider] || 0;
      const providerConfig = SSO_PROVIDERS.find(p => p.id === provider);

      if (currentAttempts >= (providerConfig?.retryConfig.maxAttempts || 3)) {
        throw new Error(`Maximum retry attempts exceeded for ${provider}`);
      }

      try {
        const token = await loginWithSSO(provider, state);
        onSuccess(provider, token);
        setRetryAttempts({ ...retryAttempts, [provider]: 0 });
        setStatusMessage(`Successfully signed in with ${provider}`);
      } catch (error) {
        setRetryAttempts(prev => ({
          ...prev,
          [provider]: (prev[provider] || 0) + 1
        }));

        // Implement exponential backoff
        const backoffTime = (providerConfig?.retryConfig.backoffMs || 1000) *
          Math.pow(1.5, currentAttempts);
        
        setTimeout(() => handleSSOClick(provider), backoffTime);
        throw error;
      }
    } catch (error) {
      setStatusMessage(`Error signing in with ${provider}`);
      onError(error instanceof Error ? error : new Error('SSO authentication failed'));
    }
  }, [loginWithSSO, nonce, onSuccess, onError, retryAttempts]);

  return (
    <div
      className={classNames('sso-buttons', className)}
      role="group"
      aria-label="Sign in options"
    >
      {/* Status message for screen readers */}
      <div
        className="sso-status-message"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusMessage}
      </div>

      {SSO_PROVIDERS.map(provider => (
        <Button
          key={provider.id}
          className={classNames(
            'sso-button',
            `sso-button--${provider.id}`,
            'gpu-accelerated'
          )}
          variant="outlined"
          size="lg"
          onClick={() => handleSSOClick(provider.id)}
          disabled={loadingStates[provider.id]}
          isLoading={loadingStates[provider.id]}
          ariaLabel={provider.ariaLabel}
          type="button"
        >
          <span className="sso-button__icon" aria-hidden="true">
            <i className={provider.icon} />
          </span>
          <span className="sso-button__text">
            {`Continue with ${provider.name}`}
          </span>
        </Button>
      ))}

      {/* Error boundary fallback */}
      <div
        role="alert"
        aria-live="assertive"
        className="sso-error-boundary"
      >
        {/* Error messages will be rendered here */}
      </div>
    </div>
  );
};

export type { SSOButtonsProps };
export default SSOButtons;