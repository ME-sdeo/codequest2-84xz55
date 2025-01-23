/**
 * @fileoverview Analytics API client module for CodeQuest frontend application
 * Handles team performance metrics, historical data, and analytics visualizations
 * with enhanced error handling, validation, and security measures.
 * @version 1.0.0
 */

// External imports
import type { AxiosResponse } from 'axios'; // v1.4.0

// Internal imports
import { apiClient, handleApiError } from '../utils/api.utils';
import { endpoints } from '../config/api.config';
import type { 
  AnalyticsFilter, 
  TeamAnalytics, 
  MetricType,
  TimeRange 
} from '../types/analytics.types';

// Constants for analytics validation
const MAX_TEAM_COMPARISON = 5;
const MAX_TREND_PERIOD_DAYS = 365;
const CACHE_DURATION = {
  ANALYTICS: 5 * 60 * 1000, // 5 minutes
  TREND: 15 * 60 * 1000 // 15 minutes
};

// Cache storage
const analyticsCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Validates analytics filter parameters
 * @param filter Analytics filter criteria
 * @throws Error if validation fails
 */
const validateAnalyticsFilter = (filter: AnalyticsFilter): void => {
  if (filter.startDate >= filter.endDate) {
    throw new Error('Start date must be before end date');
  }

  const daysDiff = Math.ceil(
    (filter.endDate.getTime() - filter.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff > MAX_TREND_PERIOD_DAYS) {
    throw new Error(`Time range cannot exceed ${MAX_TREND_PERIOD_DAYS} days`);
  }
};

/**
 * Validates team ID format
 * @param teamId Team identifier to validate
 * @throws Error if validation fails
 */
const validateTeamId = (teamId: string): void => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(teamId)) {
    throw new Error('Invalid team ID format');
  }
};

/**
 * Retrieves cached data if available and not expired
 * @param key Cache key
 * @param duration Cache duration in milliseconds
 * @returns Cached data or null if expired/not found
 */
const getCachedData = <T>(key: string, duration: number): T | null => {
  const cached = analyticsCache.get(key);
  if (cached && Date.now() - cached.timestamp < duration) {
    return cached.data as T;
  }
  return null;
};

/**
 * Caches data with expiration
 * @param key Cache key
 * @param data Data to cache
 * @param duration Cache duration in milliseconds
 */
const setCacheData = (key: string, data: any, duration: number): void => {
  analyticsCache.set(key, {
    data,
    timestamp: Date.now()
  });

  // Cleanup expired cache after duration
  setTimeout(() => {
    analyticsCache.delete(key);
  }, duration);
};

/**
 * Retrieves analytics data for a specific team with enhanced validation and error handling
 * @param teamId Team identifier
 * @param filter Analytics filter criteria
 * @returns Promise resolving to team analytics data
 */
export const getTeamAnalytics = async (
  teamId: string,
  filter: AnalyticsFilter
): Promise<TeamAnalytics> => {
  try {
    validateTeamId(teamId);
    validateAnalyticsFilter(filter);

    const cacheKey = `team-analytics-${teamId}-${JSON.stringify(filter)}`;
    const cachedData = getCachedData<TeamAnalytics>(cacheKey, CACHE_DURATION.ANALYTICS);
    if (cachedData) {
      return cachedData;
    }

    const response = await apiClient.get<TeamAnalytics>(
      `${endpoints.analytics}/teams/${teamId}`,
      {
        params: {
          timeRange: filter.timeRange,
          startDate: filter.startDate.toISOString(),
          endDate: filter.endDate.toISOString(),
          activityTypes: filter.activityTypes
        }
      }
    );

    setCacheData(cacheKey, response.data, CACHE_DURATION.ANALYTICS);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Retrieves comparative analytics data for multiple teams with concurrent request handling
 * @param teamIds Array of team identifiers
 * @param filter Analytics filter criteria
 * @returns Promise resolving to array of team analytics data
 */
export const getTeamsComparison = async (
  teamIds: string[],
  filter: AnalyticsFilter
): Promise<TeamAnalytics[]> => {
  try {
    if (!teamIds.length || teamIds.length > MAX_TEAM_COMPARISON) {
      throw new Error(`Number of teams must be between 1 and ${MAX_TEAM_COMPARISON}`);
    }

    teamIds.forEach(validateTeamId);
    validateAnalyticsFilter(filter);

    const cacheKey = `teams-comparison-${teamIds.join('-')}-${JSON.stringify(filter)}`;
    const cachedData = getCachedData<TeamAnalytics[]>(cacheKey, CACHE_DURATION.ANALYTICS);
    if (cachedData) {
      return cachedData;
    }

    const requests = teamIds.map(teamId =>
      apiClient.get<TeamAnalytics>(`${endpoints.analytics}/teams/${teamId}`, {
        params: {
          timeRange: filter.timeRange,
          startDate: filter.startDate.toISOString(),
          endDate: filter.endDate.toISOString(),
          activityTypes: filter.activityTypes
        }
      })
    );

    const responses = await Promise.all(requests);
    const data = responses.map(response => response.data);
    
    setCacheData(cacheKey, data, CACHE_DURATION.ANALYTICS);
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Retrieves historical trend data for a specific metric with enhanced validation
 * @param teamId Team identifier
 * @param metricType Type of metric to analyze
 * @param filter Analytics filter criteria
 * @returns Promise resolving to array of metric values
 */
export const getMetricTrend = async (
  teamId: string,
  metricType: MetricType,
  filter: AnalyticsFilter
): Promise<number[]> => {
  try {
    validateTeamId(teamId);
    validateAnalyticsFilter(filter);

    if (!Object.values(MetricType).includes(metricType)) {
      throw new Error('Invalid metric type');
    }

    const cacheKey = `metric-trend-${teamId}-${metricType}-${JSON.stringify(filter)}`;
    const cachedData = getCachedData<number[]>(cacheKey, CACHE_DURATION.TREND);
    if (cachedData) {
      return cachedData;
    }

    const response = await apiClient.get<number[]>(
      `${endpoints.analytics}/teams/${teamId}/trends/${metricType}`,
      {
        params: {
          timeRange: filter.timeRange,
          startDate: filter.startDate.toISOString(),
          endDate: filter.endDate.toISOString()
        }
      }
    );

    setCacheData(cacheKey, response.data, CACHE_DURATION.TREND);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};