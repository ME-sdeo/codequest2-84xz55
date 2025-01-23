/**
 * @fileoverview Authentication layout component providing consistent structure for login,
 * registration, and SSO flows with Material Design 3 compliance and accessibility support.
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import { useMediaQuery, useTheme } from '@mui/material'; // v5.0.0
import Card from '../components/common/Card';
import LoginForm from '../components/auth/LoginForm';
import SSOButtons from '../components/auth/SSOButtons';

// Styled container with responsive and RTL support
const AuthContainer = styled('div')<{ isRTL: boolean; highContrast: boolean }>(
  ({ theme, isRTL, highContrast }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: theme.spacing(4),
    background: highContrast 
      ? theme.palette.background.default 
      : theme.palette.background.paper,
    direction: isRTL ? 'rtl' : 'ltr',
    position: 'relative',
    overflow: 'auto',
    contain: 'content',
    willChange: 'transform',

    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  })
);

// Logo container with responsive sizing
const LogoContainer = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(4),
  textAlign: 'center',
  
  '& img': {
    maxWidth: '200px',
    height: 'auto',
    
    [theme.breakpoints.down('sm')]: {
      maxWidth: '150px',
    },
  },
}));

// Content wrapper with elevation and spacing
const ContentWrapper = styled('div')(({ theme }) => ({
  width: '100%',
  maxWidth: '440px',
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
}));

// Props interface with accessibility options
interface AuthLayoutProps {
  /** Child components to render */
  children: React.ReactNode;
  /** Optional additional CSS class */
  className?: string;
  /** Authentication page variant */
  variant: 'login' | 'register' | 'reset-password';
  /** RTL support flag */
  isRTL?: boolean;
  /** High contrast mode flag */
  highContrast?: boolean;
  /** Reduced motion preference flag */
  reducedMotion?: boolean;
}

/**
 * Authentication layout component with comprehensive accessibility
 * and responsive design support following Material Design principles.
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  className,
  variant,
  isRTL = false,
  highContrast = false,
  reducedMotion = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Focus management for accessibility
  const handleFocusTrap = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  // Setup focus trap and cleanup
  useEffect(() => {
    document.addEventListener('keydown', handleFocusTrap);
    return () => {
      document.removeEventListener('keydown', handleFocusTrap);
    };
  }, [handleFocusTrap]);

  // Set initial focus
  useEffect(() => {
    const firstInput = document.querySelector('input:not([type="hidden"])') as HTMLElement;
    if (firstInput && !isMobile) {
      firstInput.focus();
    }
  }, [isMobile]);

  return (
    <AuthContainer
      className={className}
      isRTL={isRTL}
      highContrast={highContrast}
      role="main"
      aria-label={`${variant} page`}
    >
      <ContentWrapper>
        <LogoContainer>
          <img
            src="/assets/logo.svg"
            alt="CodeQuest Logo"
            width={200}
            height={60}
            loading="eager"
          />
        </LogoContainer>

        <Card
          elevated
          className="auth-card"
          role="region"
          aria-label={`${variant} form`}
          highContrast={highContrast}
        >
          {children}

          {variant === 'login' && (
            <SSOButtons
              className="auth-sso-buttons"
              onSuccess={(provider, token) => {
                // SSO success handling will be implemented by parent
              }}
              onError={(error) => {
                // Error handling will be implemented by parent
              }}
              nonce={crypto.randomUUID()}
            />
          )}
        </Card>

        {/* Skip link for keyboard navigation */}
        <div className="visually-hidden">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
        </div>

        {/* Status messages for screen readers */}
        <div
          role="status"
          aria-live="polite"
          className="visually-hidden"
        >
          {`${variant} page loaded`}
        </div>
      </ContentWrapper>

      {/* Reduced motion styles */}
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
        
        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .skip-link {
          position: absolute;
          top: -40px;
          left: 0;
          background: ${theme.palette.primary.main};
          color: white;
          padding: 8px;
          z-index: 100;
          
          &:focus {
            top: 0;
          }
        }
      `}</style>
    </AuthContainer>
  );
};

export type { AuthLayoutProps };
export default AuthLayout;