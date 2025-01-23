/**
 * @fileoverview Redux slice for managing analytics state in CodeQuest application
 * Handles team performance metrics, historical data, and analytics visualization
 * with enhanced error handling and cache management
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  AnalyticsFilter,
  TeamAnalytics,
  MetricType,
  TimeRange
} from '../types/analytics.types';
import {
  getTeamAnalytics,
  getTeamsComparison,
  getMetricTrend
} from '../api/analytics.api';

// Constants for cache management
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Interface defining the analytics slice state structure
 */
interface AnalyticsState {
  teamAnalytics: TeamAnalytics[];
  currentFilter: AnalyticsFilter | null;
  loadingStates: Record<string, boolean>;
  errors: Record<string, { code: string; message: string; timestamp: number }>;
  metricTrends: Record<string, number[]>;
  comparisonData: TeamAnalytics[];
  cache: Record<string, { data: any; timestamp: number; isStale: boolean }>;
}

/**
 * Initial state for analytics slice
 */
const initialState: AnalyticsState = {
  teamAnalytics: [],
  currentFilter: null,
  loadingStates: {},
  errors: {},
  metricTrends: {},
  comparisonData: [],
  cache: {}
};

/**
 * Async thunk for fetching team analytics data
 */
export const fetchTeamAnalytics = createAsyncThunk(
  'analytics/fetchTeamAnalytics',
  async (
    { teamId, filter }: { teamId: string; filter: AnalyticsFilter },
    { rejectWithValue }
  ) => {
    try {
      const response = await getTeamAnalytics(teamId, filter);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Failed to fetch team analytics'
      });
    }
  }
);

/**
 * Async thunk for fetching comparative team data
 */
export const fetchTeamsComparison = createAsyncThunk(
  'analytics/fetchTeamsComparison',
  async (
    { teamIds, filter }: { teamIds: string[]; filter: AnalyticsFilter },
    { rejectWithValue }
  ) => {
    try {
      const response = await getTeamsComparison(teamIds, filter);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Failed to fetch teams comparison'
      });
    }
  }
);

/**
 * Async thunk for fetching metric trend data
 */
export const fetchMetricTrend = createAsyncThunk(
  'analytics/fetchMetricTrend',
  async (
    {
      teamId,
      metricType,
      filter
    }: { teamId: string; metricType: MetricType; filter: AnalyticsFilter },
    { rejectWithValue }
  ) => {
    try {
      const response = await getMetricTrend(teamId, metricType, filter);
      return { teamId, metricType, data: response };
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Failed to fetch metric trend'
      });
    }
  }
);

/**
 * Analytics slice with reducers and actions
 */
const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setCurrentFilter: (state, action: PayloadAction<AnalyticsFilter>) => {
      state.currentFilter = action.payload;
    },
    clearErrors: (state) => {
      state.errors = {};
    },
    invalidateCache: (state, action: PayloadAction<string>) => {
      if (state.cache[action.payload]) {
        state.cache[action.payload].isStale = true;
      }
    },
    clearCache: (state) => {
      state.cache = {};
    }
  },
  extraReducers: (builder) => {
    // Team Analytics
    builder
      .addCase(fetchTeamAnalytics.pending, (state, action) => {
        const teamId = action.meta.arg.teamId;
        state.loadingStates[`team_${teamId}`] = true;
        delete state.errors[`team_${teamId}`];
      })
      .addCase(fetchTeamAnalytics.fulfilled, (state, action) => {
        const teamId = action.meta.arg.teamId;
        state.loadingStates[`team_${teamId}`] = false;
        state.teamAnalytics = state.teamAnalytics
          .filter(team => team.teamId !== teamId)
          .concat(action.payload);
        
        // Update cache
        const cacheKey = `team_${teamId}`;
        state.cache[cacheKey] = {
          data: action.payload,
          timestamp: Date.now(),
          isStale: false
        };
      })
      .addCase(fetchTeamAnalytics.rejected, (state, action) => {
        const teamId = action.meta.arg.teamId;
        state.loadingStates[`team_${teamId}`] = false;
        state.errors[`team_${teamId}`] = {
          ...(action.payload as { code: string; message: string }),
          timestamp: Date.now()
        };
      })

    // Teams Comparison
      .addCase(fetchTeamsComparison.pending, (state) => {
        state.loadingStates['comparison'] = true;
        delete state.errors['comparison'];
      })
      .addCase(fetchTeamsComparison.fulfilled, (state, action) => {
        state.loadingStates['comparison'] = false;
        state.comparisonData = action.payload;
        
        // Update cache
        state.cache['comparison'] = {
          data: action.payload,
          timestamp: Date.now(),
          isStale: false
        };
      })
      .addCase(fetchTeamsComparison.rejected, (state, action) => {
        state.loadingStates['comparison'] = false;
        state.errors['comparison'] = {
          ...(action.payload as { code: string; message: string }),
          timestamp: Date.now()
        };
      })

    // Metric Trends
      .addCase(fetchMetricTrend.pending, (state, action) => {
        const { teamId, metricType } = action.meta.arg;
        state.loadingStates[`trend_${teamId}_${metricType}`] = true;
        delete state.errors[`trend_${teamId}_${metricType}`];
      })
      .addCase(fetchMetricTrend.fulfilled, (state, action) => {
        const { teamId, metricType, data } = action.payload;
        const key = `trend_${teamId}_${metricType}`;
        state.loadingStates[key] = false;
        state.metricTrends[key] = data;
        
        // Update cache
        state.cache[key] = {
          data,
          timestamp: Date.now(),
          isStale: false
        };
      })
      .addCase(fetchMetricTrend.rejected, (state, action) => {
        const { teamId, metricType } = action.meta.arg;
        const key = `trend_${teamId}_${metricType}`;
        state.loadingStates[key] = false;
        state.errors[key] = {
          ...(action.payload as { code: string; message: string }),
          timestamp: Date.now()
        };
      });
  }
});

// Export actions
export const {
  setCurrentFilter,
  clearErrors,
  invalidateCache,
  clearCache
} = analyticsSlice.actions;

// Export selector
export const selectAnalyticsState = (state: { analytics: AnalyticsState }) => state.analytics;

// Export reducer
export default analyticsSlice.reducer;