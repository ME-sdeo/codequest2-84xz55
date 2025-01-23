/**
 * @fileoverview Root Redux store configuration with enhanced security, performance optimization,
 * and multi-tenant support for the CodeQuest frontend application.
 * @version 1.0.0
 */

// External imports - Redux Toolkit v1.9.5
import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit';
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Internal imports - Reducers
import activityReducer from './activity.slice';
import analyticsReducer from './analytics.slice';
import authReducer from './auth.slice';
import pointsReducer from './points.slice';
import teamReducer from './team.slice';

// Performance monitoring middleware
const performanceMiddleware: Middleware = () => (next) => (action) => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  // Log actions taking longer than 500ms (from technical specs)
  if (duration > 500) {
    console.warn(`Action ${action.type} took ${duration.toFixed(2)}ms to process`);
  }

  return result;
};

// Multi-tenant isolation middleware
const tenantMiddleware: Middleware = (store) => (next) => (action) => {
  const currentTenant = store.getState().auth?.currentUser?.companyId;
  
  if (currentTenant) {
    // Attach tenant context to all actions
    action.meta = {
      ...action.meta,
      tenant: currentTenant
    };
  }
  
  return next(action);
};

// Error boundary middleware
const errorMiddleware: Middleware = () => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux Error:', error);
    // Re-throw error for error boundary
    throw error;
  }
};

// Configure persistence with tenant isolation
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'], // Only persist auth state
  blacklist: ['activity', 'analytics', 'points', 'team'], // Don't persist these states
  version: 1,
  // Clean up stale data on rehydration
  migrate: (state: any) => {
    // Remove any cached data older than 12 hours
    const CACHE_EXPIRY = 12 * 60 * 60 * 1000;
    const now = Date.now();

    Object.keys(state).forEach(key => {
      if (state[key]?.lastUpdated && now - state[key].lastUpdated > CACHE_EXPIRY) {
        delete state[key];
      }
    });

    return Promise.resolve(state);
  }
};

// Auth-specific persistence config
const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['currentUser', 'accessToken'],
  blacklist: ['loading', 'error']
};

// Combine reducers with proper typing
const rootReducer = combineReducers({
  activity: activityReducer,
  analytics: analyticsReducer,
  auth: persistReducer(authPersistConfig, authReducer),
  points: pointsReducer,
  team: teamReducer
});

// Configure store with middleware and devtools
export const store = configureStore({
  reducer: persistReducer(persistConfig, rootReducer),
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
      },
      // Increase timeout for large state trees
      immutableCheck: { warnAfter: 300 },
      serializableCheck: { warnAfter: 300 }
    }).concat([
      performanceMiddleware,
      tenantMiddleware,
      errorMiddleware
    ]),
  devTools: process.env.NODE_ENV !== 'production',
  // Optimize for large state trees
  enhancers: []
});

// Configure persistor
export const persistor = persistStore(store, {
  manualPersist: false,
  // Clean up on errors
  serialize: true,
  timeout: 2000 // 2 second timeout
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store instance
export default store;