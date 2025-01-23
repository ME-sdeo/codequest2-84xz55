/**
 * @fileoverview Redux slice for team management with real-time updates and tenant isolation
 * Implements team state management, WebSocket integration, and optimized performance
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import { Team, TeamSortField } from '../types/team.types';
import { ApiResponse } from '../types/common.types';
import { WebSocketService } from '../services/websocket.service';
import { endpoints, buildTenantPath } from '../config/api.config';

// Constants for performance optimization
const DEBOUNCE_DELAY = 500;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ITEMS_PER_PAGE = 20;

/**
 * Interface for team slice state with tenant isolation and caching
 */
interface TeamState {
  teams: Team[];
  currentTeam: Team | null;
  loading: boolean;
  error: string | null;
  pagination: {
    itemsPerPage: number;
    currentPage: number;
    totalItems: number;
  };
  isWebSocketConnected: boolean;
  cache: {
    lastUpdated: Record<string, number>;
    teamData: Record<string, Team[]>;
  };
  currentTenantId: string | null;
  sortField: TeamSortField;
  sortDirection: 'asc' | 'desc';
}

// Initial state with proper initialization
const initialState: TeamState = {
  teams: [],
  currentTeam: null,
  loading: false,
  error: null,
  pagination: {
    itemsPerPage: ITEMS_PER_PAGE,
    currentPage: 1,
    totalItems: 0
  },
  isWebSocketConnected: false,
  cache: {
    lastUpdated: {},
    teamData: {}
  },
  currentTenantId: null,
  sortField: TeamSortField.TOTAL_POINTS,
  sortDirection: 'desc'
};

// Async thunks for team operations
export const fetchTeams = createAsyncThunk(
  'team/fetchTeams',
  async ({ tenantId, page = 1 }: { tenantId: string; page?: number }, { rejectWithValue }) => {
    try {
      const response = await fetch(
        buildTenantPath(endpoints.team, tenantId) + `?page=${page}&size=${ITEMS_PER_PAGE}`
      );
      const data: ApiResponse<{ teams: Team[]; total: number }> = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateTeam = createAsyncThunk(
  'team/updateTeam',
  async ({ tenantId, team }: { tenantId: string; team: Team }, { rejectWithValue }) => {
    try {
      const response = await fetch(buildTenantPath(endpoints.team, tenantId) + `/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(team)
      });
      const data: ApiResponse<Team> = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// WebSocket connection management
let wsService: WebSocketService | null = null;

const initializeWebSocket = (tenantId: string): void => {
  if (wsService) return;
  
  wsService = new WebSocketService({
    url: `${process.env.VITE_WS_URL}/teams/${tenantId}`
  });

  wsService.subscribe('team:update', handleRealTimeUpdate);
  wsService.subscribe('team:points', handlePointsUpdate);
};

// Debounced handler for real-time updates
const handleRealTimeUpdate = debounce((updateData: Partial<Team>) => {
  if (!teamSlice.getInitialState().currentTenantId) return;
  
  store.dispatch(teamSlice.actions.updateTeamData(updateData));
}, DEBOUNCE_DELAY);

// Team slice with comprehensive state management
export const teamSlice = createSlice({
  name: 'team',
  initialState,
  reducers: {
    setCurrentTenant: (state, action: PayloadAction<string>) => {
      state.currentTenantId = action.payload;
      state.teams = [];
      state.cache = { lastUpdated: {}, teamData: {} };
      initializeWebSocket(action.payload);
    },
    updateTeamData: (state, action: PayloadAction<Partial<Team>>) => {
      const index = state.teams.findIndex(team => team.id === action.payload.id);
      if (index !== -1) {
        state.teams[index] = { ...state.teams[index], ...action.payload };
        if (state.currentTeam?.id === action.payload.id) {
          state.currentTeam = { ...state.currentTeam, ...action.payload };
        }
      }
    },
    setWebSocketStatus: (state, action: PayloadAction<boolean>) => {
      state.isWebSocketConnected = action.payload;
    },
    setSortField: (state, action: PayloadAction<{ field: TeamSortField; direction: 'asc' | 'desc' }>) => {
      state.sortField = action.payload.field;
      state.sortDirection = action.payload.direction;
      state.teams = sortTeams(state.teams, action.payload.field, action.payload.direction);
    },
    clearTeamState: (state) => {
      Object.assign(state, initialState);
      if (wsService) {
        wsService.disconnect();
        wsService = null;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeams.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeams.fulfilled, (state, action) => {
        state.loading = false;
        state.teams = sortTeams(action.payload.teams, state.sortField, state.sortDirection);
        state.pagination.totalItems = action.payload.total;
        if (state.currentTenantId) {
          state.cache.teamData[state.currentTenantId] = action.payload.teams;
          state.cache.lastUpdated[state.currentTenantId] = Date.now();
        }
      })
      .addCase(fetchTeams.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateTeam.fulfilled, (state, action) => {
        const index = state.teams.findIndex(team => team.id === action.payload.id);
        if (index !== -1) {
          state.teams[index] = action.payload;
        }
      });
  }
});

// Utility function for sorting teams
const sortTeams = (teams: Team[], field: TeamSortField, direction: 'asc' | 'desc'): Team[] => {
  return [...teams].sort((a, b) => {
    const compareValue = direction === 'asc' ? 1 : -1;
    return a[field] > b[field] ? compareValue : -compareValue;
  });
};

// Export actions and selectors
export const {
  setCurrentTenant,
  updateTeamData,
  setWebSocketStatus,
  setSortField,
  clearTeamState
} = teamSlice.actions;

// Memoized selectors for optimized performance
export const selectTeams = (state: { team: TeamState }) => state.team.teams;
export const selectCurrentTeam = (state: { team: TeamState }) => state.team.currentTeam;
export const selectTeamsByTenant = (tenantId: string) => 
  (state: { team: TeamState }) => state.team.cache.teamData[tenantId] || [];
export const selectTeamLoading = (state: { team: TeamState }) => state.team.loading;
export const selectTeamError = (state: { team: TeamState }) => state.team.error;

export default teamSlice.reducer;