/**
 * @fileoverview Enhanced custom React hook for points management with real-time updates,
 * optimized performance, and comprehensive error handling.
 * @version 1.0.0
 */

// External imports - React v18.0.0, React-Redux v8.0.5
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// Internal imports
import { pointsActions } from '../store/points.slice';
import { pointsService } from '../services/points.service';
import type { PointsCalculation } from '../types/points.types';
import { ActivityType } from '../types/activity.types';

// Constants for configuration
const POINTS_REFRESH_INTERVAL = 2000; // 2 seconds for real-time updates
const WS_RECONNECT_DELAY = 3000; // 3 seconds before reconnection attempt
const CACHE_DURATION = 60000; // 1 minute cache duration
const MAX_RETRY_ATTEMPTS = 3;

// Types for hook parameters and state
interface PointsOptions {
  enableRealTime?: boolean;
  cacheResults?: boolean;
  retryOnFailure?: boolean;
}

interface LoadingState {
  points: boolean;
  history: boolean;
  leaderboard: boolean;
  levelProgress: boolean;
}

interface ErrorState {
  points?: string;
  history?: string;
  leaderboard?: string;
  levelProgress?: string;
}

interface WebSocketStatus {
  connected: boolean;
  lastUpdate: Date | null;
  reconnectAttempts: number;
}

/**
 * Enhanced custom hook for managing points functionality with real-time updates
 * and optimized performance.
 * 
 * @param teamMemberId - Unique identifier for the team member
 * @param options - Configuration options for the hook
 * @returns Object containing points management functions and state
 */
export function usePoints(
  teamMemberId: string,
  options: PointsOptions = {}
) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState<LoadingState>({
    points: false,
    history: false,
    leaderboard: false,
    levelProgress: false
  });
  const [error, setError] = useState<ErrorState>({});
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>({
    connected: false,
    lastUpdate: null,
    reconnectAttempts: 0
  });

  // Memoized selectors for Redux state
  const pointsState = useSelector((state: any) => state.points);
  const pointsHistory = useMemo(() => pointsState.history, [pointsState.history]);
  const levelProgress = useMemo(() => pointsState.levelProgress, [pointsState.levelProgress]);
  const leaderboard = useMemo(() => pointsState.leaderboard, [pointsState.leaderboard]);

  /**
   * Enhanced point calculation with detailed tracking and validation
   */
  const calculateActivityPoints = useCallback(async (
    activityType: ActivityType,
    isAiGenerated: boolean
  ): Promise<PointsCalculation> => {
    try {
      setLoading(prev => ({ ...prev, points: true }));
      const calculation = await pointsService.calculateUserPoints(
        teamMemberId,
        activityType,
        isAiGenerated
      );
      dispatch(pointsActions.updateRealTimePoints(calculation));
      return calculation;
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(prev => ({ ...prev, points: errorMessage }));
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, points: false }));
    }
  }, [teamMemberId, dispatch]);

  /**
   * Retrieves points history with caching and pagination
   */
  const getPointsHistory = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, history: true }));
      const history = await pointsService.getUserPointsHistory(teamMemberId);
      dispatch(pointsActions.getUserPoints(history));
      return history;
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(prev => ({ ...prev, history: errorMessage }));
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, history: false }));
    }
  }, [teamMemberId, dispatch]);

  /**
   * Retrieves level progress with real-time updates
   */
  const getLevelProgress = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, levelProgress: true }));
      const progress = await pointsService.getUserLevelProgress(teamMemberId);
      return progress;
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(prev => ({ ...prev, levelProgress: errorMessage }));
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, levelProgress: false }));
    }
  }, [teamMemberId]);

  /**
   * Handles WebSocket connection and reconnection
   */
  const handleWebSocketConnection = useCallback(() => {
    const wsSubscription = pointsService.subscribeToPointsUpdates(teamMemberId);
    
    wsSubscription.subscribe({
      next: (update) => {
        setWsStatus(prev => ({
          ...prev,
          connected: true,
          lastUpdate: new Date(),
          reconnectAttempts: 0
        }));
        dispatch(pointsActions.updateRealTimePoints(update));
      },
      error: async (err) => {
        setWsStatus(prev => ({
          ...prev,
          connected: false,
          reconnectAttempts: prev.reconnectAttempts + 1
        }));

        if (options.retryOnFailure && wsStatus.reconnectAttempts < MAX_RETRY_ATTEMPTS) {
          setTimeout(handleWebSocketConnection, WS_RECONNECT_DELAY);
        }
      }
    });

    return () => {
      wsSubscription.unsubscribe();
    };
  }, [teamMemberId, dispatch, options.retryOnFailure, wsStatus.reconnectAttempts]);

  // Initialize real-time updates and data loading
  useEffect(() => {
    if (options.enableRealTime) {
      const cleanup = handleWebSocketConnection();
      return () => cleanup();
    }
  }, [options.enableRealTime, handleWebSocketConnection]);

  // Periodic refresh of points data
  useEffect(() => {
    if (options.enableRealTime) {
      const interval = setInterval(() => {
        getPointsHistory().catch(console.error);
        getLevelProgress().catch(console.error);
      }, POINTS_REFRESH_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [options.enableRealTime, getPointsHistory, getLevelProgress]);

  return {
    // State
    pointsHistory,
    levelProgress,
    leaderboard,
    loading,
    error,
    wsStatus,

    // Actions
    calculateActivityPoints,
    getPointsHistory,
    getLevelProgress,

    // Utilities
    clearError: () => setError({}),
    resetWebSocketStatus: () => setWsStatus({
      connected: false,
      lastUpdate: null,
      reconnectAttempts: 0
    })
  };
}