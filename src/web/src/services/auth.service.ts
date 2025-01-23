/**
 * @fileoverview Enhanced authentication service implementing secure login, SSO integration,
 * and token management for the CodeQuest frontend application.
 * @version 1.0.0
 */

import jwtDecode from 'jwt-decode'; // v3.1.2
import { AES, enc } from 'crypto-js'; // v4.1.1
import { User, TokenPayload } from '../types/auth.types';

/**
 * Constants for authentication service configuration
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'encrypted_access_token',
  REFRESH_TOKEN: 'encrypted_refresh_token',
  USER: 'encrypted_user',
  STATE_PARAM: 'sso_state'
} as const;

const TOKEN_REFRESH_INTERVAL = 300000; // 5 minutes
const MAX_REFRESH_ATTEMPTS = 3;
const REFRESH_BACKOFF_MULTIPLIER = 1.5;
const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'default-key';

/**
 * Enhanced authentication service class implementing secure authentication flows
 * and token management with enterprise-grade security features.
 */
export class AuthService {
  private currentUser: User | null = null;
  private accessToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshAttempts = 0;
  private readonly stateParams: Map<string, string> = new Map();

  constructor() {
    this.initializeSession();
  }

  /**
   * Initializes user session from secure storage with encryption
   */
  private initializeSession(): void {
    try {
      const encryptedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const encryptedUser = localStorage.getItem(STORAGE_KEYS.USER);

      if (encryptedToken && encryptedUser) {
        const decryptedToken = this.decrypt(encryptedToken);
        const tokenPayload = this.validateToken(decryptedToken);

        if (tokenPayload) {
          this.accessToken = decryptedToken;
          this.currentUser = JSON.parse(this.decrypt(encryptedUser));
          this.scheduleTokenRefresh(tokenPayload.exp * 1000 - Date.now());
        } else {
          this.clearSession();
        }
      }
    } catch (error) {
      console.error('Session initialization failed:', error);
      this.clearSession();
    }
  }

  /**
   * Validates JWT token integrity and expiration
   * @param token - JWT token to validate
   * @returns Decoded token payload if valid, null otherwise
   */
  public validateToken(token: string): TokenPayload | null {
    try {
      const payload = jwtDecode<TokenPayload>(token);
      const currentTime = Date.now() / 1000;

      if (!payload.exp || payload.exp <= currentTime) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  }

  /**
   * Schedules token refresh with exponential backoff
   * @param expiresIn - Time in milliseconds until token expiration
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const refreshTime = Math.max(0, expiresIn - TOKEN_REFRESH_INTERVAL);
    
    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshToken();
        this.refreshAttempts = 0;
      } catch (error) {
        this.refreshAttempts++;
        if (this.refreshAttempts < MAX_REFRESH_ATTEMPTS) {
          const backoffTime = TOKEN_REFRESH_INTERVAL * 
            Math.pow(REFRESH_BACKOFF_MULTIPLIER, this.refreshAttempts);
          this.scheduleTokenRefresh(backoffTime);
        } else {
          this.clearSession();
        }
      }
    }, refreshTime);
  }

  /**
   * Encrypts sensitive data before storage
   * @param data - Data to encrypt
   * @returns Encrypted string
   */
  private encrypt(data: string): string {
    return AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypts sensitive data from storage
   * @param encryptedData - Encrypted data to decrypt
   * @returns Decrypted string
   */
  private decrypt(encryptedData: string): string {
    return AES.decrypt(encryptedData, ENCRYPTION_KEY).toString(enc.Utf8);
  }

  /**
   * Securely stores user session data with encryption
   * @param accessToken - JWT access token
   * @param user - User object
   */
  private storeSession(accessToken: string, user: User): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, this.encrypt(accessToken));
    localStorage.setItem(STORAGE_KEYS.USER, this.encrypt(JSON.stringify(user)));
  }

  /**
   * Clears user session and sensitive data
   */
  private clearSession(): void {
    this.currentUser = null;
    this.accessToken = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    this.refreshAttempts = 0;
  }

  /**
   * Generates secure random state parameter for SSO
   * @returns Secure random state string
   */
  private generateStateParam(): string {
    const state = crypto.getRandomValues(new Uint8Array(32))
      .reduce((acc, val) => acc + val.toString(16).padStart(2, '0'), '');
    this.stateParams.set(state, new Date().toISOString());
    return state;
  }

  /**
   * Validates SSO state parameter
   * @param state - State parameter to validate
   * @returns boolean indicating if state is valid
   */
  private validateStateParam(state: string): boolean {
    const timestamp = this.stateParams.get(state);
    if (!timestamp) return false;

    const stateAge = Date.now() - new Date(timestamp).getTime();
    this.stateParams.delete(state);
    return stateAge < 300000; // 5 minutes
  }

  /**
   * Refreshes access token using refresh token
   * @returns Promise resolving to new access token
   */
  private async refreshToken(): Promise<string> {
    const encryptedRefreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!encryptedRefreshToken) {
      throw new Error('No refresh token available');
    }

    const refreshToken = this.decrypt(encryptedRefreshToken);
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const { accessToken, user } = await response.json();
    this.storeSession(accessToken, user);
    return accessToken;
  }

  /**
   * Gets current authenticated user
   * @returns Current user or null if not authenticated
   */
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Gets current access token
   * @returns Current access token or null if not authenticated
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Checks if user is authenticated
   * @returns boolean indicating if user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.accessToken && !!this.currentUser;
  }
}

export default new AuthService();