/**
 * @fileoverview Redux Toolkit slice for managing Azure DevOps activity state
 * Handles real-time updates, point calculations with AI detection, and multi-tenant isolation
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.0
import { Activity } from '../types/activity.types';
import { ACTIVITY_DISPLAY_CONFIG } from '../constants/activity.constants';
import { getActivities } from '../api/activity.api';
import type { RootState } from './store';

/**
 * Enhanced interface for activity slice state with real-time and tenant support
 */
interface ActivityState {
  activities: Activity[];
  selectedActivity: Activity | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  realTimeUpdateEnabled: boolean;
  lastUpdateTimestamp: number;
  currentTenantId: string;
  pointsCalculationConfig: {
    aiModifier: number;
    updateInterval: number;
  };
}

/**
 * Initial state with production-ready defaults
 */
const initialState: ActivityState = {
  activities: [],
  selectedActivity: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0
  },
  realTimeUpdateEnabled: true,
  lastUpdateTimestamp: 0,
  currentTenantId: '',
  pointsCalculationConfig: {
    aiModifier: 0.75,
    updateInterval: 2000
  }
};

/**
 * Enhanced async thunk for fetching activities with real-time support
 */
export const fetchActivities = createAsyncThunk(
  'activity/fetchActivities',
  async (params: { page: number; limit: number; teamId?: string; tenantId: string }, { rejectWithValue }) => {
    try {
      const response = await getActivities({
        page: params.page,
        limit: params.limit,
        teamId: params.teamId
      });

      if (!response.success) {
        return rejectWithValue(response.error || 'Failed to fetch activities');
      }

      return response.data;
    } catch (error) {
      return rejectWithValue('Error fetching activities');
    }
  }
);

/**
 * Activity slice with enhanced real-time and multi-tenant support
 */
const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    setSelectedActivity: (state, action: PayloadAction<Activity | null>) => {
      state.selectedActivity = action.payload;
    },
    setTenantId: (state, action: PayloadAction<string>) => {
      state.currentTenantId = action.payload;
    },
    toggleRealTimeUpdates: (state, action: PayloadAction<boolean>) => {
      state.realTimeUpdateEnabled = action.payload;
    },
    updateActivityPoints: (state, action: PayloadAction<{ activityId: string; points: number }>) => {
      const activity = state.activities.find(a => a.id === action.payload.activityId);
      if (activity) {
        activity.points = action.payload.points;
      }
    },
    addRealTimeActivity: (state, action: PayloadAction<Activity>) => {
      if (state.realTimeUpdateEnabled && action.payload.tenantId === state.currentTenantId) {
        state.activities.unshift(action.payload);
        state.pagination.total += 1;
        state.lastUpdateTimestamp = Date.now();
      }
    },
    updateAIDetection: (state, action: PayloadAction<{ activityId: string; isAIGenerated: boolean }>) => {
      const activity = state.activities.find(a => a.id === action.payload.activityId);
      if (activity) {
        activity.isAIGenerated = action.payload.isAIGenerated;
        const basePoints = ACTIVITY_DISPLAY_CONFIG[activity.type].basePoints;
        activity.points = action.payload.isAIGenerated ? 
          basePoints * state.pointsCalculationConfig.aiModifier : 
          basePoints;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivities.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        state.loading = false;
        state.activities = action.payload;
        state.lastUpdateTimestamp = Date.now();
      })
      .addCase(fetchActivities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

// Export actions
export const {
  setSelectedActivity,
  setTenantId,
  toggleRealTimeUpdates,
  updateActivityPoints,
  addRealTimeActivity,
  updateAIDetection
} = activitySlice.actions;

// Selectors
export const selectActivitiesByTenant = (state: RootState) => 
  state.activity.activities.filter(activity => activity.tenantId === state.activity.currentTenantId);

export const selectRealTimeStatus = (state: RootState) => ({
  enabled: state.activity.realTimeUpdateEnabled,
  lastUpdate: state.activity.lastUpdateTimestamp
});

export const selectActivityById = (id: string) => (state: RootState) =>
  state.activity.activities.find(activity => activity.id === id);

export const selectPagination = (state: RootState) => state.activity.pagination;

export const selectLoadingState = (state: RootState) => ({
  loading: state.activity.loading,
  error: state.activity.error
});

// Export reducer
export default activitySlice.reducer;