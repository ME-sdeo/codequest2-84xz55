/**
 * @fileoverview Custom React hook for managing analytics state and operations
 * Provides comprehensive analytics functionality with enhanced caching, error handling,
 * and performance optimizations for CodeQuest application
 * @version 1.0.0
 */

import { useCallback, useEffect, useState } from 'react'; // v18.0.0
import { useSelector, useDispatch } from 'react-redux'; // v8.0.0
import { AnalyticsService } from '../services/analytics.service';
import {
  actions,
  selectAnalyticsState,
} from '../store/analytics.slice';
import type {
  AnalyticsFilter,
  TeamAnalytics,
  MetricType,
  TimeRange,
  AnalyticsError
} from '../types/analytics.types';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const STALE_WHILE_REVALIDATE = 30 * 1000; // 30 seconds

/**
 * Interface for the analytics hook return value
 */
interface UseAnalyticsReturn {
  loading: boolean;
  error: AnalyticsError | null;
  progress: number;
  teamMetrics: TeamAnalytics | null;
  fetchTeamMetrics: (teamId: string, filter: AnalyticsFilter) => Promise<void>;
  compareTeamMetrics: (teamIds: string[], filter: AnalyticsFilter) => Promise<TeamAnalytics[]>;
  getMetricTrend: (
    teamId: string,
    metricType: MetricType,
    timeRange: TimeRange
  ) => Promise<{ values: number[]; labels: string[] }>;
  clearCache: () => void;
  isStale: boolean;
}

/**
 * Custom hook for managing analytics operations with enhanced performance and error handling
 * @returns {UseAnalyticsReturn} Analytics hook interface with comprehensive state and operations
 */
export const useAnalytics = (): UseAnalyticsReturn => {
  const dispatch = useDispatch();
  const analyticsState = useSelector(selectAnalyticsState);

  // Local state management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AnalyticsError | null>(null);
  const [progress, setProgress] = useState(0);
  const [isStale, setIsStale] = useState(false);

  /**
   * Fetches analytics data for a specific team with caching and error handling
   * @param teamId - Team identifier
   * @param filter - Analytics filter criteria
   */
  const fetchTeamMetrics = useCallback(async (
    teamId: string,
    filter: AnalyticsFilter
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setProgress(10);

      // Check cache
      const cacheKey = `team_${teamId}_${JSON.stringify(filter)}`;
      const cachedData = analyticsState.cache[cacheKey];

      if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
        setProgress(100);
        dispatch(actions.setCurrentFilter(filter));
        setLoading(false);
        return;
      }

      setProgress(30);
      const analytics = await AnalyticsService.fetchTeamAnalytics(teamId, filter);
      setProgress(70);

      dispatch(actions.setCurrentFilter(filter));
      setProgress(90);

      // Update cache
      dispatch({
        type: 'analytics/updateCache',
        payload: {
          key: cacheKey,
          data: analytics,
          timestamp: Date.now()
        }
      });

      setProgress(100);
    } catch (err: any) {
      setError({
        code: err.code || 'ANALYTICS_ERROR',
        message: err.message || 'Failed to fetch team analytics'
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Compares analytics data between multiple teams with batch optimization
   * @param teamIds - Array of team identifiers
   * @param filter - Analytics filter criteria
   * @returns Promise resolving to comparative analytics data
   */
  const compareTeamMetrics = useCallback(async (
    teamIds: string[],
    filter: AnalyticsFilter
  ): Promise<TeamAnalytics[]> => {
    try {
      setLoading(true);
      setError(null);
      setProgress(10);

      const cacheKey = `comparison_${teamIds.join('_')}_${JSON.stringify(filter)}`;
      const cachedData = analyticsState.cache[cacheKey];

      if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
        setProgress(100);
        return cachedData.data;
      }

      setProgress(30);
      const comparisonData = await AnalyticsService.compareTeams(teamIds, filter);
      setProgress(70);

      // Update cache
      dispatch({
        type: 'analytics/updateCache',
        payload: {
          key: cacheKey,
          data: comparisonData,
          timestamp: Date.now()
        }
      });

      setProgress(100);
      return comparisonData;
    } catch (err: any) {
      setError({
        code: err.code || 'COMPARISON_ERROR',
        message: err.message || 'Failed to compare teams'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Retrieves historical trend data with progressive loading
   * @param teamId - Team identifier
   * @param metricType - Type of metric to analyze
   * @param timeRange - Time range for trend analysis
   * @returns Promise resolving to trend data with labels
   */
  const getMetricTrend = useCallback(async (
    teamId: string,
    metricType: MetricType,
    timeRange: TimeRange
  ): Promise<{ values: number[]; labels: string[] }> => {
    try {
      setLoading(true);
      setError(null);
      setProgress(10);

      const cacheKey = `trend_${teamId}_${metricType}_${timeRange}`;
      const cachedData = analyticsState.cache[cacheKey];

      if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
        setProgress(100);
        return cachedData.data;
      }

      setProgress(30);
      const trendData = await AnalyticsService.getMetricHistory(
        teamId,
        metricType,
        { timeRange, startDate: new Date(), endDate: new Date() }
      );
      setProgress(70);

      const processedData = {
        values: trendData,
        labels: generateTimeLabels(timeRange, trendData.length)
      };

      // Update cache
      dispatch({
        type: 'analytics/updateCache',
        payload: {
          key: cacheKey,
          data: processedData,
          timestamp: Date.now()
        }
      });

      setProgress(100);
      return processedData;
    } catch (err: any) {
      setError({
        code: err.code || 'TREND_ERROR',
        message: err.message || 'Failed to fetch metric trend'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Generates time labels for trend data visualization
   * @param timeRange - Selected time range
   * @param pointCount - Number of data points
   * @returns Array of formatted time labels
   */
  const generateTimeLabels = (timeRange: TimeRange, pointCount: number): string[] => {
    const labels: string[] = [];
    const now = new Date();
    const format = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: timeRange === TimeRange.DAY ? 'numeric' : undefined
    });

    for (let i = pointCount - 1; i >= 0; i--) {
      const date = new Date(now);
      switch (timeRange) {
        case TimeRange.DAY:
          date.setHours(date.getHours() - i);
          break;
        case TimeRange.WEEK:
          date.setDate(date.getDate() - i);
          break;
        case TimeRange.MONTH:
          date.setDate(date.getDate() - (i * 2));
          break;
        default:
          date.setDate(date.getDate() - (i * 7));
      }
      labels.push(format.format(date));
    }
    return labels;
  };

  /**
   * Clears all cached analytics data
   */
  const clearCache = useCallback((): void => {
    dispatch(actions.clearCache());
  }, [dispatch]);

  // Check cache staleness
  useEffect(() => {
    const checkCacheStaleness = () => {
      const now = Date.now();
      const hasStaleData = Object.values(analyticsState.cache).some(
        cache => now - cache.timestamp > STALE_WHILE_REVALIDATE
      );
      setIsStale(hasStaleData);
    };

    const interval = setInterval(checkCacheStaleness, STALE_WHILE_REVALIDATE);
    return () => clearInterval(interval);
  }, [analyticsState.cache]);

  return {
    loading,
    error,
    progress,
    teamMetrics: analyticsState.teamAnalytics[0] || null,
    fetchTeamMetrics,
    compareTeamMetrics,
    getMetricTrend,
    clearCache,
    isStale
  };
};