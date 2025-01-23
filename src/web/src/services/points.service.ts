/**
 * @fileoverview Points service for managing points-related functionality in the frontend application.
 * Implements real-time point tracking, AI detection modifiers, level progression, and leaderboard management.
 * @version 1.0.0
 */

// External imports
import { BehaviorSubject } from 'rxjs'; // v7.0.0
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'; // v7.0.0
import { ApplicationInsights } from '@microsoft/applicationinsights-web'; // v2.8.0

// Internal imports
import { pointsApi } from '../api/points.api';
import { calculatePoints, calculateLevelProgress, formatPoints } from '../utils/points.utils';
import type { 
  PointsConfig, 
  PointsHistory, 
  LevelProgress, 
  LeaderboardEntry 
} from '../types/points.types';
import { ActivityType } from '../types/activity.types';
import { DEFAULT_POINTS_CONFIG } from '../constants/points.constants';

// Service configuration constants
const CONFIG_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const LEADERBOARD_UPDATE_INTERVAL = 60 * 1000; // 1 minute
const POINTS_UPDATE_DEBOUNCE = 500; // 500ms
const WS_RECONNECT_ATTEMPTS = 3;
const WS_RECONNECT_DELAY = 1000;

// Telemetry instance
const telemetry = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.VITE_APPINSIGHTS_KEY,
    enableAutoRouteTracking: true
  }
});

// State management
const pointsConfigSubject = new BehaviorSubject<PointsConfig | null>(null);
const leaderboardSubject = new BehaviorSubject<LeaderboardEntry[]>([]);
let configCacheTimestamp: number = 0;
let currentOrganizationId: string | null = null;

/**
 * Initializes the points service with configuration and real-time updates
 * @param organizationId - Organization identifier for tenant isolation
 */
const initializePointsService = async (organizationId: string): Promise<void> => {
  try {
    currentOrganizationId = organizationId;
    telemetry.trackEvent({ name: 'PointsServiceInitialization', properties: { organizationId }});

    // Initialize configuration
    const config = await pointsApi.getPointsConfig(organizationId, { enableCache: true });
    if (config.success) {
      pointsConfigSubject.next(config.data);
      configCacheTimestamp = Date.now();
    }

    // Set up real-time updates
    const wsSubscription = pointsApi.subscribeToPointUpdates(organizationId)
      .pipe(
        debounceTime(POINTS_UPDATE_DEBOUNCE),
        distinctUntilChanged()
      )
      .subscribe({
        next: (update) => handlePointsUpdate(update),
        error: (error) => handleWebSocketError(error)
      });

    // Initialize leaderboard
    await refreshLeaderboard();

    return Promise.resolve();
  } catch (error) {
    telemetry.trackException({ exception: error as Error });
    return Promise.reject(error);
  }
};

/**
 * Retrieves current points configuration with caching
 * @returns Current points configuration
 */
const getPointsConfiguration = async (): Promise<PointsConfig> => {
  try {
    // Check cache validity
    if (
      pointsConfigSubject.value && 
      Date.now() - configCacheTimestamp < CONFIG_CACHE_TIMEOUT
    ) {
      return pointsConfigSubject.value;
    }

    // Fetch fresh configuration
    const config = await pointsApi.getPointsConfig(
      currentOrganizationId!, 
      { enableCache: false }
    );

    if (config.success) {
      pointsConfigSubject.next(config.data);
      configCacheTimestamp = Date.now();
      return config.data;
    }

    // Fallback to default config
    return DEFAULT_POINTS_CONFIG;
  } catch (error) {
    telemetry.trackException({ exception: error as Error });
    return DEFAULT_POINTS_CONFIG;
  }
};

/**
 * Retrieves points history for a user with pagination
 * @param userId - User identifier
 * @param page - Page number
 * @param pageSize - Items per page
 */
const getUserPointsHistory = async (
  userId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PointsHistory[]> => {
  try {
    const response = await pointsApi.getPointsHistory(userId, {
      page,
      pageSize,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    });

    return response.success ? response.data.data : [];
  } catch (error) {
    telemetry.trackException({ exception: error as Error });
    return [];
  }
};

/**
 * Calculates points for a user activity with AI detection
 * @param userId - User identifier
 * @param activityType - Type of activity
 * @param isAiGenerated - Whether the activity involves AI-generated code
 */
const calculateUserPoints = async (
  userId: string,
  activityType: ActivityType,
  isAiGenerated: boolean
): Promise<number> => {
  try {
    const config = await getPointsConfiguration();
    const calculation = calculatePoints(activityType, isAiGenerated, config);
    
    telemetry.trackMetric({
      name: 'PointsCalculation',
      average: calculation.finalPoints,
      properties: {
        userId,
        activityType,
        isAiGenerated
      }
    });

    return calculation.finalPoints;
  } catch (error) {
    telemetry.trackException({ exception: error as Error });
    return 0;
  }
};

/**
 * Retrieves user's current level and progress
 * @param userId - User identifier
 */
const getUserLevelProgress = async (userId: string): Promise<LevelProgress> => {
  try {
    const response = await pointsApi.getLevelProgress(userId);
    if (response.success) {
      return response.data;
    }
    throw new Error('Failed to fetch level progress');
  } catch (error) {
    telemetry.trackException({ exception: error as Error });
    throw error;
  }
};

/**
 * Retrieves team leaderboard with real-time updates
 * @param teamId - Team identifier
 */
const getTeamLeaderboard = async (teamId: string): Promise<LeaderboardEntry[]> => {
  try {
    const response = await pointsApi.getLeaderboard(teamId);
    if (response.success) {
      leaderboardSubject.next(response.data);
      return response.data;
    }
    return leaderboardSubject.value;
  } catch (error) {
    telemetry.trackException({ exception: error as Error });
    return leaderboardSubject.value;
  }
};

// Private helper functions
const handlePointsUpdate = (update: any) => {
  telemetry.trackEvent({ name: 'PointsUpdate', properties: update });
  refreshLeaderboard();
};

const handleWebSocketError = async (error: Error) => {
  telemetry.trackException({ exception: error });
  for (let i = 0; i < WS_RECONNECT_ATTEMPTS; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, WS_RECONNECT_DELAY));
      await initializePointsService(currentOrganizationId!);
      return;
    } catch (retryError) {
      telemetry.trackException({ exception: retryError as Error });
    }
  }
};

const refreshLeaderboard = async () => {
  if (currentOrganizationId) {
    await getTeamLeaderboard(currentOrganizationId);
  }
};

// Initialize telemetry
telemetry.loadAppInsights();
telemetry.trackPageView();

// Export the points service
export const pointsService = {
  initializePointsService,
  getPointsConfiguration,
  getUserPointsHistory,
  calculateUserPoints,
  getUserLevelProgress,
  getTeamLeaderboard
};