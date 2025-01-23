/**
 * @fileoverview Comprehensive test suite for authentication pages including login,
 * registration, and SSO functionality with extensive coverage of accessibility,
 * error handling, and user flows.
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import { ErrorBoundary } from 'react-error-boundary';
import LoginPage from '../../src/pages/auth/LoginPage';
import RegisterPage from '../../src/pages/auth/RegisterPage';
import { useAuth } from '../../src/hooks/useAuth';

// Mock hooks and services
vi.mock('../../src/hooks/useAuth');
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Test utilities
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ErrorBoundary fallback={<div>Error Boundary</div>}>
      {component}
    </ErrorBoundary>
  );
};

const setupMockAuth = (config = {}) => {
  const mockAuth = {
    login: vi.fn(),
    register: vi.fn(),
    ssoLogin: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    error: null,
    ...config,
  };
  (useAuth as jest.Mock).mockReturnValue(mockAuth);
  return mockAuth;
};

describe('Authentication Pages', () => {
  describe('Login Page', () => {
    beforeEach(() => {
      setupMockAuth();
    });

    it('should render login form with all required fields', () => {
      renderWithProviders(<LoginPage />);
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      renderWithProviders(<LoginPage />);
      
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
    });

    it('should handle successful login', async () => {
      const mockAuth = setupMockAuth({
        login: vi.fn().mockResolvedValue({ success: true }),
      });

      renderWithProviders(<LoginPage />);
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'Password123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockAuth.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
        });
      });
    });

    it('should handle login errors with rate limiting', async () => {
      const mockAuth = setupMockAuth({
        login: vi.fn().mockRejectedValue(new Error('Invalid credentials')),
      });

      renderWithProviders(<LoginPage />);
      
      // Attempt multiple logins
      for (let i = 0; i < 6; i++) {
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
        await waitFor(() => {
          expect(mockAuth.login).toHaveBeenCalled();
        });
      }

      expect(screen.getByText(/account locked/i)).toBeInTheDocument();
    });

    it('should support SSO authentication', async () => {
      const mockAuth = setupMockAuth({
        ssoLogin: vi.fn().mockResolvedValue({ success: true }),
      });

      renderWithProviders(<LoginPage />);
      
      const ssoButton = screen.getByRole('button', { name: /azure/i });
      fireEvent.click(ssoButton);

      await waitFor(() => {
        expect(mockAuth.ssoLogin).toHaveBeenCalled();
      });
    });

    it('should be accessible', async () => {
      const { container } = renderWithProviders(<LoginPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Register Page', () => {
    beforeEach(() => {
      setupMockAuth();
    });

    it('should render registration form with all required fields', () => {
      renderWithProviders(<RegisterPage />);
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    });

    it('should validate password requirements', async () => {
      renderWithProviders(<RegisterPage />);
      
      const passwordInput = screen.getByLabelText(/password/i);
      fireEvent.change(passwordInput, { target: { value: 'weak' } });
      fireEvent.blur(passwordInput);
      
      await waitFor(() => {
        expect(screen.getByText(/password must contain/i)).toBeInTheDocument();
      });
    });

    it('should handle successful registration', async () => {
      const mockAuth = setupMockAuth({
        register: vi.fn().mockResolvedValue({ success: true }),
      });

      renderWithProviders(<RegisterPage />);
      
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByLabelText(/role/i), {
        target: { value: 'DEVELOPER' },
      });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(mockAuth.register).toHaveBeenCalled();
      });
    });

    it('should conditionally render organization fields', async () => {
      renderWithProviders(<RegisterPage />);
      
      const roleSelect = screen.getByLabelText(/role/i);
      fireEvent.change(roleSelect, { target: { value: 'ORG_ADMIN' } });
      
      await waitFor(() => {
        expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/company id/i)).toBeInTheDocument();
      });
    });

    it('should handle registration errors', async () => {
      const mockAuth = setupMockAuth({
        register: vi.fn().mockRejectedValue(new Error('Email already exists')),
      });

      renderWithProviders(<RegisterPage />);
      
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
      });
    });

    it('should support SSO registration', async () => {
      const mockAuth = setupMockAuth({
        ssoLogin: vi.fn().mockResolvedValue({ success: true }),
      });

      renderWithProviders(<RegisterPage />);
      
      const ssoButton = screen.getByRole('button', { name: /azure/i });
      fireEvent.click(ssoButton);

      await waitFor(() => {
        expect(mockAuth.ssoLogin).toHaveBeenCalled();
      });
    });

    it('should be accessible', async () => {
      const { container } = renderWithProviders(<RegisterPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockAuth = setupMockAuth({
        login: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      renderWithProviders(<LoginPage />);
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should handle timeout errors', async () => {
      const mockAuth = setupMockAuth({
        login: vi.fn().mockRejectedValue(new Error('Request timeout')),
      });

      renderWithProviders(<LoginPage />);
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid tokens', async () => {
      const mockAuth = setupMockAuth({
        isAuthenticated: true,
        login: vi.fn().mockRejectedValue(new Error('Invalid token')),
      });

      renderWithProviders(<LoginPage />);
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid token/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security Features', () => {
    it('should include CSRF token in requests', async () => {
      const mockAuth = setupMockAuth();
      renderWithProviders(<LoginPage />);
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('data-csrf');
    });

    it('should enforce rate limiting', async () => {
      const mockAuth = setupMockAuth({
        login: vi.fn().mockRejectedValue(new Error('Invalid credentials')),
      });

      renderWithProviders(<LoginPage />);
      
      // Attempt multiple logins
      for (let i = 0; i < 6; i++) {
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      }

      await waitFor(() => {
        expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
      });
    });

    it('should mask sensitive information', () => {
      renderWithProviders(<LoginPage />);
      
      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});