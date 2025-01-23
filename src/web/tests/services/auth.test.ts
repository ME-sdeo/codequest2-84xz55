import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import MockAdapter from 'axios-mock-adapter'; // v1.21.0
import { AES } from 'crypto-js'; // v4.1.1
import AuthService from '../../src/services/auth.service';
import { User, TokenPayload, AuthResponse, Role } from '../../src/types/auth.types';

// Mock crypto API
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => array.map(() => Math.floor(Math.random() * 256))
};
global.crypto = mockCrypto as unknown as Crypto;

// Test constants
const MOCK_TOKENS = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6IkRFVkVMT1BFUiIsImV4cCI6OTk5OTk5OTk5OX0',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicmVmcmVzaCI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ',
  expiresIn: 3600
};

const MOCK_USER: User = {
  id: '123',
  email: 'test@example.com',
  role: Role.DEVELOPER,
  companyId: 'comp_123',
  organizationId: 'org_123',
  isActive: true,
  lastLoginAt: new Date(),
  ssoData: {},
  permissions: ['read:all', 'write:own'],
  sessionId: 'session_123',
  createdAt: new Date(),
  updatedAt: new Date()
};

const SSO_PROVIDERS = {
  AZURE_AD: 'azure',
  OKTA: 'okta',
  AUTH0: 'auth0'
};

describe('AuthService Security Tests', () => {
  let authService: AuthService;
  let mockStorage: { [key: string]: string };

  beforeEach(() => {
    // Mock localStorage
    mockStorage = {};
    global.localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
      length: 0,
      key: () => null
    };

    authService = new AuthService();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage = {};
  });

  describe('Token Management', () => {
    test('should securely store encrypted tokens', () => {
      // @ts-ignore - Accessing private method for testing
      authService.storeSession(MOCK_TOKENS.accessToken, MOCK_USER);
      
      const storedToken = localStorage.getItem('encrypted_access_token');
      expect(storedToken).toBeDefined();
      expect(storedToken).not.toBe(MOCK_TOKENS.accessToken);
    });

    test('should validate token expiration', () => {
      const validToken = MOCK_TOKENS.accessToken;
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ';

      const validResult = authService.validateToken(validToken);
      const expiredResult = authService.validateToken(expiredToken);

      expect(validResult).toBeTruthy();
      expect(expiredResult).toBeNull();
    });

    test('should handle token refresh with backoff', async () => {
      const mockRefresh = jest.fn().mockResolvedValueOnce(MOCK_TOKENS.accessToken);
      // @ts-ignore - Mocking private method
      authService.refreshToken = mockRefresh;

      // @ts-ignore - Accessing private method for testing
      authService.scheduleTokenRefresh(1000);

      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(mockRefresh).toHaveBeenCalled();
    });

    test('should clear session on token compromise', () => {
      // @ts-ignore - Accessing private method for testing
      authService.storeSession(MOCK_TOKENS.accessToken, MOCK_USER);
      
      // Simulate token tampering
      localStorage.setItem('encrypted_access_token', 'tampered_token');
      
      // @ts-ignore - Accessing private method for testing
      authService.initializeSession();
      
      expect(authService.isAuthenticated()).toBeFalsy();
      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('SSO Integration', () => {
    test('should generate secure state parameters', () => {
      // @ts-ignore - Accessing private method for testing
      const state = authService.generateStateParam();
      
      expect(state).toHaveLength(64); // 32 bytes in hex
      expect(typeof state).toBe('string');
    });

    test('should validate state parameter age', () => {
      // @ts-ignore - Accessing private method for testing
      const state = authService.generateStateParam();
      
      // @ts-ignore - Accessing private method for testing
      const validResult = authService.validateStateParam(state);
      expect(validResult).toBeTruthy();

      // Simulate expired state
      jest.advanceTimersByTime(301000); // 5 minutes + 1 second
      // @ts-ignore - Accessing private method for testing
      const expiredResult = authService.validateStateParam(state);
      expect(expiredResult).toBeFalsy();
    });

    test('should prevent state parameter replay attacks', () => {
      // @ts-ignore - Accessing private method for testing
      const state = authService.generateStateParam();
      
      // @ts-ignore - Accessing private method for testing
      const firstValidation = authService.validateStateParam(state);
      // @ts-ignore - Accessing private method for testing
      const secondValidation = authService.validateStateParam(state);

      expect(firstValidation).toBeTruthy();
      expect(secondValidation).toBeFalsy();
    });
  });

  describe('Session Security', () => {
    test('should encrypt sensitive user data', () => {
      // @ts-ignore - Accessing private method for testing
      authService.storeSession(MOCK_TOKENS.accessToken, MOCK_USER);
      
      const storedUser = localStorage.getItem('encrypted_user');
      expect(storedUser).toBeDefined();
      expect(storedUser).not.toContain(MOCK_USER.email);
    });

    test('should handle session initialization failures gracefully', () => {
      localStorage.setItem('encrypted_access_token', 'invalid_encrypted_data');
      localStorage.setItem('encrypted_user', 'invalid_encrypted_data');

      // @ts-ignore - Accessing private method for testing
      authService.initializeSession();

      expect(authService.isAuthenticated()).toBeFalsy();
      expect(localStorage.getItem('encrypted_access_token')).toBeNull();
    });

    test('should clear all sensitive data on logout', () => {
      // @ts-ignore - Accessing private method for testing
      authService.storeSession(MOCK_TOKENS.accessToken, MOCK_USER);
      
      // @ts-ignore - Accessing private method for testing
      authService.clearSession();

      expect(localStorage.getItem('encrypted_access_token')).toBeNull();
      expect(localStorage.getItem('encrypted_user')).toBeNull();
      expect(authService.getCurrentUser()).toBeNull();
      expect(authService.getAccessToken()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle token validation errors securely', () => {
      const invalidToken = 'invalid.jwt.token';
      const result = authService.validateToken(invalidToken);
      
      expect(result).toBeNull();
    });

    test('should handle decryption failures securely', () => {
      localStorage.setItem('encrypted_access_token', 'invalid_encryption');
      
      // @ts-ignore - Accessing private method for testing
      authService.initializeSession();

      expect(authService.isAuthenticated()).toBeFalsy();
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle refresh token failures with retry logic', async () => {
      const mockRefresh = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(MOCK_TOKENS.accessToken);

      // @ts-ignore - Mocking private method
      authService.refreshToken = mockRefresh;

      // @ts-ignore - Accessing private method for testing
      await authService.scheduleTokenRefresh(1000);

      expect(mockRefresh).toHaveBeenCalledTimes(3);
    });
  });
});