import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useAuth } from '../../src/hooks/useAuth';
import authReducer, { login, logout, refreshToken } from '../../src/store/auth.slice';
import type { User, LoginCredentials } from '../../src/types/auth.types';
import { Role } from '../../src/types/common.types';

// Test constants
const TEST_USER: User = {
  id: 'test-id',
  email: 'test@example.com',
  role: Role.DEVELOPER,
  companyId: 'company-id',
  organizationId: 'org-id',
  isActive: true,
  lastLoginAt: new Date(),
  permissions: ['read:points', 'write:activities'],
  sessionId: 'test-session',
  createdAt: new Date(),
  updatedAt: new Date(),
  ssoData: {}
};

const TEST_CREDENTIALS: LoginCredentials = {
  email: 'test@example.com',
  password: 'test-password'
};

const TEST_SSO_CREDENTIALS: LoginCredentials = {
  email: 'test@example.com',
  password: '',
  ssoToken: 'test.sso.token'
};

const TEST_MFA_CREDENTIALS: LoginCredentials = {
  ...TEST_CREDENTIALS,
  mfaToken: '123456'
};

// Mock store setup
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: {
        currentUser: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        tokenExpiry: null,
        requiresMfa: false,
        ssoToken: null,
        ...initialState
      }
    }
  });
};

// Test wrapper component
const createWrapper = (store: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with default unauthenticated state', () => {
      const store = createTestStore();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBeFalsy();
      expect(result.current.isLoading).toBeFalsy();
      expect(result.current.error).toBeNull();
    });

    it('should initialize with existing authenticated state', () => {
      const store = createTestStore({
        currentUser: TEST_USER,
        accessToken: 'test.token',
        isAuthenticated: true
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      expect(result.current.user).toEqual(TEST_USER);
      expect(result.current.isAuthenticated).toBeTruthy();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      await act(async () => {
        await result.current.login(TEST_CREDENTIALS);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBeTruthy();
        expect(result.current.user).toBeTruthy();
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle login failure', async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      const invalidCredentials = { ...TEST_CREDENTIALS, password: 'wrong' };

      await act(async () => {
        try {
          await result.current.login(invalidCredentials);
        } catch (error) {
          expect(error).toBeTruthy();
        }
      });

      expect(result.current.isAuthenticated).toBeFalsy();
      expect(result.current.error).toBeTruthy();
    });

    it('should handle MFA requirements', async () => {
      const store = createTestStore({ requiresMfa: true });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      await act(async () => {
        try {
          await result.current.login(TEST_CREDENTIALS);
        } catch (error) {
          expect(error.message).toContain('MFA token required');
        }
      });

      await act(async () => {
        await result.current.login(TEST_MFA_CREDENTIALS);
      });

      expect(result.current.isAuthenticated).toBeTruthy();
    });
  });

  describe('SSO Integration', () => {
    it('should handle SSO login flow', async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      await act(async () => {
        await result.current.login(TEST_SSO_CREDENTIALS);
      });

      expect(result.current.isAuthenticated).toBeTruthy();
      expect(result.current.user?.ssoData.provider).toBeTruthy();
    });

    it('should validate SSO token', async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      const invalidSSOCredentials = {
        ...TEST_SSO_CREDENTIALS,
        ssoToken: 'invalid.token'
      };

      await act(async () => {
        try {
          await result.current.login(invalidSSOCredentials);
        } catch (error) {
          expect(error.message).toContain('Invalid token');
        }
      });

      expect(result.current.isAuthenticated).toBeFalsy();
    });
  });

  describe('Token Management', () => {
    it('should handle token refresh', async () => {
      const store = createTestStore({
        currentUser: TEST_USER,
        accessToken: 'test.token',
        isAuthenticated: true,
        tokenExpiry: Date.now() + 3600000 // 1 hour
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      // Fast-forward past refresh interval
      jest.advanceTimersByTime(300000); // 5 minutes

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBeTruthy();
        // Verify new token was issued
        expect(store.getState().auth.accessToken).not.toBe('test.token');
      });
    });

    it('should handle token refresh failure with retry', async () => {
      const store = createTestStore({
        currentUser: TEST_USER,
        accessToken: 'test.token',
        isAuthenticated: true,
        tokenExpiry: Date.now() + 3600000
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      // Simulate three failed refresh attempts
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(300000);
        await waitFor(() => {
          expect(store.getState().auth.refreshAttempts).toBe(i + 1);
        });
      }

      // Should logout after max retries
      expect(result.current.isAuthenticated).toBeFalsy();
      expect(result.current.user).toBeNull();
    });
  });

  describe('Logout Flow', () => {
    it('should handle logout and cleanup', async () => {
      const store = createTestStore({
        currentUser: TEST_USER,
        accessToken: 'test.token',
        isAuthenticated: true
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBeFalsy();
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('encrypted_access_token')).toBeNull();
      expect(localStorage.getItem('encrypted_refresh_token')).toBeNull();
    });
  });

  describe('Security Validations', () => {
    it('should prevent login with invalid credentials', async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      const invalidCredentials = { email: '', password: '' };

      await act(async () => {
        try {
          await result.current.login(invalidCredentials);
        } catch (error) {
          expect(error.message).toContain('Invalid credentials');
        }
      });

      expect(result.current.isAuthenticated).toBeFalsy();
    });

    it('should validate token integrity', async () => {
      const store = createTestStore();
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(store)
      });

      await act(async () => {
        await result.current.login(TEST_CREDENTIALS);
      });

      // Simulate token tampering
      localStorage.setItem('encrypted_access_token', 'tampered.token');

      await act(async () => {
        try {
          await result.current.refreshToken();
        } catch (error) {
          expect(error.message).toContain('Invalid token');
        }
      });

      expect(result.current.isAuthenticated).toBeFalsy();
    });
  });
});