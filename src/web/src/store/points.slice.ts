/**
 * @fileoverview Redux slice for managing points-related state in the frontend application.
 * Implements real-time updates, optimized performance, and comprehensive error handling
 * for points configuration, history, level progress, and leaderboard data.
 * @version 1.0.0
 */

// External imports - @reduxjs/toolkit v1.9.0
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Internal imports
import { 
  PointsConfig, 
  PointsHistory, 
  LevelProgress, 
  LeaderboardEntry 
} from '../types/points.types';
import { pointsService } from '../services/points.service';
import { ActivityType } from '../types/activity.types';

// State interface with enhanced error handling and loading states
interface PointsState {
  config: PointsConfig | null;
  history: PointsHistory[];
  levelProgress: LevelProgress | null;
  leaderboard: LeaderboardEntry[];
  loadingStates: Record<string, boolean>;
  errors: Record<string, string | null>;
  isWebSocketConnected: boolean;
}

// Initial state
const initialState: PointsState = {
  config: null,
  history: [],
  levelProgress: null,
  leaderboard: [],
  loadingStates: {},
  errors: {},
  isWebSocketConnected: false
};

// Async thunks
export const fetchPointsConfig = createAsyncThunk(
  'points/fetchConfig',
  async (organizationId: string, { rejectWithValue }) => {
    try {
      const config = await pointsService.getPointsConfiguration();
      return config;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchPointsHistory = createAsyncThunk(
  'points/fetchHistory',
  async (userId: string, { rejectWithValue }) => {
    try {
      const history = await pointsService.getUserPointsHistory(userId);
      return history;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchLevelProgress = createAsyncThunk(
  'points/fetchLevelProgress',
  async (userId: string, { rejectWithValue }) => {
    try {
      const progress = await pointsService.getUserLevelProgress(userId);
      return progress;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchLeaderboard = createAsyncThunk(
  'points/fetchLeaderboard',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const leaderboard = await pointsService.getTeamLeaderboard(teamId);
      return leaderboard;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Points slice
const pointsSlice = createSlice({
  name: 'points',
  initialState,
  reducers: {
    setWebSocketConnection(state, action: PayloadAction<boolean>) {
      state.isWebSocketConnected = action.payload;
    },
    updatePointsInRealTime(state, action: PayloadAction<PointsHistory>) {
      state.history.unshift(action.payload);
      // Maintain history size limit
      if (state.history.length > 100) {
        state.history.pop();
      }
    },
    updateLeaderboardInRealTime(state, action: PayloadAction<LeaderboardEntry[]>) {
      state.leaderboard = action.payload;
    },
    clearErrors(state) {
      state.errors = {};
    }
  },
  extraReducers: (builder) => {
    // Points Config
    builder
      .addCase(fetchPointsConfig.pending, (state) => {
        state.loadingStates['config'] = true;
        state.errors['config'] = null;
      })
      .addCase(fetchPointsConfig.fulfilled, (state, action) => {
        state.config = action.payload;
        state.loadingStates['config'] = false;
      })
      .addCase(fetchPointsConfig.rejected, (state, action) => {
        state.loadingStates['config'] = false;
        state.errors['config'] = action.payload as string;
      })

    // Points History
    builder
      .addCase(fetchPointsHistory.pending, (state) => {
        state.loadingStates['history'] = true;
        state.errors['history'] = null;
      })
      .addCase(fetchPointsHistory.fulfilled, (state, action) => {
        state.history = action.payload;
        state.loadingStates['history'] = false;
      })
      .addCase(fetchPointsHistory.rejected, (state, action) => {
        state.loadingStates['history'] = false;
        state.errors['history'] = action.payload as string;
      })

    // Level Progress
    builder
      .addCase(fetchLevelProgress.pending, (state) => {
        state.loadingStates['levelProgress'] = true;
        state.errors['levelProgress'] = null;
      })
      .addCase(fetchLevelProgress.fulfilled, (state, action) => {
        state.levelProgress = action.payload;
        state.loadingStates['levelProgress'] = false;
      })
      .addCase(fetchLevelProgress.rejected, (state, action) => {
        state.loadingStates['levelProgress'] = false;
        state.errors['levelProgress'] = action.payload as string;
      })

    // Leaderboard
    builder
      .addCase(fetchLeaderboard.pending, (state) => {
        state.loadingStates['leaderboard'] = true;
        state.errors['leaderboard'] = null;
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        state.leaderboard = action.payload;
        state.loadingStates['leaderboard'] = false;
      })
      .addCase(fetchLeaderboard.rejected, (state, action) => {
        state.loadingStates['leaderboard'] = false;
        state.errors['leaderboard'] = action.payload as string;
      });
  }
});

// Export actions and reducer
export const { 
  setWebSocketConnection, 
  updatePointsInRealTime, 
  updateLeaderboardInRealTime, 
  clearErrors 
} = pointsSlice.actions;

export default pointsSlice.reducer;

// Selectors with memoization
export const selectPointsConfig = (state: { points: PointsState }) => state.points.config;
export const selectPointsHistory = (state: { points: PointsState }) => state.points.history;
export const selectLevelProgress = (state: { points: PointsState }) => state.points.levelProgress;
export const selectLeaderboard = (state: { points: PointsState }) => state.points.leaderboard;
export const selectLoadingState = (state: { points: PointsState }, key: string) => 
  state.points.loadingStates[key] || false;
export const selectError = (state: { points: PointsState }, key: string) => 
  state.points.errors[key] || null;
export const selectIsWebSocketConnected = (state: { points: PointsState }) => 
  state.points.isWebSocketConnected;