/**
 * @fileoverview Redux Toolkit slice for managing authentication state with enhanced security features
 * including SSO integration, token lifecycle management, and secure storage.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { AuthState, LoginCredentials } from '../types/auth.types';
import AuthService from '../services/auth.service';

// Constants for token management
const TOKEN_REFRESH_BUFFER = 300000; // 5 minutes in milliseconds
const MAX_REFRESH_ATTEMPTS = 3;

// Initial state with strict type safety
const initialState: AuthState = {
  currentUser: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  ssoToken: null,
  tokenExpiry: null,
  lastTokenRefresh: null,
  refreshAttempts: 0,
  requiresMfa: false
};

/**
 * Async thunk for user login with enhanced security and SSO support
 */
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await AuthService.login(credentials);
      
      // Validate token before storing
      const isValidToken = AuthService.validateToken(response.accessToken);
      if (!isValidToken) {
        throw new Error('Invalid token received');
      }

      // Schedule token refresh
      AuthService.scheduleTokenRefresh(
        new Date(response.tokenExpiry).getTime() - Date.now()
      );

      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Login failed');
    }
  }
);

/**
 * Async thunk for token refresh with exponential backoff
 */
export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const response = await AuthService.refreshAccessToken();
      const isValidToken = AuthService.validateToken(response);
      
      if (!isValidToken) {
        throw new Error('Invalid refresh token response');
      }

      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Token refresh failed');
    }
  }
);

/**
 * Auth slice with comprehensive state management
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      AuthService.logout();
      return { ...initialState };
    },
    setTokenExpiry: (state, action) => {
      state.tokenExpiry = action.payload;
    },
    resetRefreshAttempts: (state) => {
      state.refreshAttempts = 0;
      state.lastTokenRefresh = Date.now();
    },
    setSsoToken: (state, action) => {
      state.ssoToken = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Login action handlers
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentUser = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.tokenExpiry = new Date(action.payload.tokenExpiry).getTime();
        state.isAuthenticated = true;
        state.refreshAttempts = 0;
        state.lastTokenRefresh = Date.now();
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Token refresh action handlers
    builder
      .addCase(refreshToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accessToken = action.payload;
        state.tokenExpiry = Date.now() + TOKEN_REFRESH_BUFFER;
        state.refreshAttempts = 0;
        state.lastTokenRefresh = Date.now();
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.refreshAttempts += 1;
        
        if (state.refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
          state.isAuthenticated = false;
          state.currentUser = null;
          state.accessToken = null;
        }
      });
  }
});

// Memoized selectors for optimized state access
export const selectAuthState = createSelector(
  [(state: { auth: AuthState }) => state.auth],
  (auth) => auth
);

export const selectTokenStatus = createSelector(
  [(state: { auth: AuthState }) => state.auth],
  (auth) => ({
    isValid: auth.isAuthenticated && auth.accessToken !== null,
    expiresIn: auth.tokenExpiry ? auth.tokenExpiry - Date.now() : null,
    needsRefresh: auth.tokenExpiry ? auth.tokenExpiry - Date.now() < TOKEN_REFRESH_BUFFER : false
  })
);

export const selectCurrentUser = createSelector(
  [(state: { auth: AuthState }) => state.auth],
  (auth) => auth.currentUser
);

// Export actions and reducer
export const { logout, setTokenExpiry, resetRefreshAttempts, setSsoToken } = authSlice.actions;
export default authSlice.reducer;