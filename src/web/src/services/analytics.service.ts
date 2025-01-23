/**
 * @fileoverview Analytics service for handling analytics operations, data transformations,
 * and caching in the frontend application with optimized performance and memory management.
 * @version 1.0.0
 */

// External imports
import memoize from 'lodash/memoize'; // v4.17.21
import retry from 'axios-retry'; // v3.5.0
import winston from 'winston'; // v3.8.2

// Internal imports
import { 
  getTeamAnalytics, 
  getTeamsComparison, 
  getMetricTrend 
} from '../api/analytics.api';
import type { 
  AnalyticsFilter, 
  TeamAnalytics, 
  MetricType, 
  TimeRange,
  TeamComparison,
  TrendAnalysis
} from '../types/analytics.types';

// Constants for cache and performance configuration
const CACHE_CONFIG = {
  MAX_AGE: 300000, // 5 minutes
  MAX_SIZE: 100,
  CLEANUP_INTERVAL: 600000 // 10 minutes
};

const RETRY_CONFIG = {
  RETRIES: 3,
  DELAY: 1000,
  BACKOFF_FACTOR: 2
};

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Memoized function to fetch and process team analytics data
 * @param teamId - Team identifier
 * @param filter - Analytics filter criteria
 * @returns Processed team analytics data
 */
const fetchTeamAnalytics = memoize(
  async (teamId: string, filter: AnalyticsFilter): Promise<TeamAnalytics> => {
    const startTime = performance.now();
    try {
      logger.info('Fetching team analytics', { teamId, filter });
      const analytics = await getTeamAnalytics(teamId, filter);
      
      const duration = performance.now() - startTime;
      logger.info('Team analytics fetched', { duration, teamId });
      
      return analytics;
    } catch (error) {
      logger.error('Error fetching team analytics', { error, teamId });
      throw error;
    }
  },
  (teamId: string, filter: AnalyticsFilter) => 
    `${teamId}-${JSON.stringify(filter)}`
);

/**
 * Compare multiple teams' performance with optimized parallel requests
 * @param teamIds - Array of team identifiers
 * @param filter - Analytics filter criteria
 * @returns Comparative analytics data
 */
const compareTeams = memoize(
  async (teamIds: string[], filter: AnalyticsFilter): Promise<TeamComparison> => {
    const startTime = performance.now();
    try {
      logger.info('Comparing teams', { teamIds, filter });
      const teamsData = await getTeamsComparison(teamIds, filter);
      
      const comparison: TeamComparison = {
        baseTeamId: teamIds[0],
        comparisonTeamIds: teamIds.slice(1),
        metrics: Object.values(MetricType),
        results: processComparisonData(teamsData)
      };

      const duration = performance.now() - startTime;
      logger.info('Teams comparison completed', { duration });
      
      return comparison;
    } catch (error) {
      logger.error('Error comparing teams', { error, teamIds });
      throw error;
    }
  },
  (teamIds: string[], filter: AnalyticsFilter) => 
    `${teamIds.join('-')}-${JSON.stringify(filter)}`
);

/**
 * Retrieve historical metric data with trend analysis
 * @param teamId - Team identifier
 * @param metricType - Type of metric to analyze
 * @param filter - Analytics filter criteria
 * @returns Trend analysis data
 */
const getMetricHistory = memoize(
  async (
    teamId: string,
    metricType: MetricType,
    filter: AnalyticsFilter
  ): Promise<TrendAnalysis> => {
    const startTime = performance.now();
    try {
      logger.info('Fetching metric history', { teamId, metricType, filter });
      const trendData = await getMetricTrend(teamId, metricType, filter);
      
      const analysis: TrendAnalysis = {
        period: filter.timeRange,
        dataPoints: processTrendData(trendData, filter)
      };

      const duration = performance.now() - startTime;
      logger.info('Metric history fetched', { duration, metricType });
      
      return analysis;
    } catch (error) {
      logger.error('Error fetching metric history', { error, teamId, metricType });
      throw error;
    }
  },
  (teamId: string, metricType: MetricType, filter: AnalyticsFilter) =>
    `${teamId}-${metricType}-${JSON.stringify(filter)}`
);

/**
 * Calculate growth rate between two periods
 * @param currentValue - Current period value
 * @param previousValue - Previous period value
 * @returns Growth rate as a percentage
 */
const calculateGrowthRate = (currentValue: number, previousValue: number): number => {
  if (previousValue === 0) return 0;
  return ((currentValue - previousValue) / previousValue) * 100;
};

/**
 * Process raw comparison data into structured format
 * @param teamsData - Raw analytics data for multiple teams
 * @returns Processed comparison results
 */
const processComparisonData = (teamsData: TeamAnalytics[]): TeamComparison['results'] => {
  const results: Record<MetricType, any> = {};
  
  Object.values(MetricType).forEach(metric => {
    const values: Record<string, number> = {};
    const differences: Record<string, number> = {};
    const baseValue = teamsData[0].metrics[metric].value;

    teamsData.forEach(team => {
      values[team.teamId] = team.metrics[metric].value;
      differences[team.teamId] = calculateGrowthRate(
        team.metrics[metric].value,
        baseValue
      );
    });

    results[metric] = { values, differences };
  });

  return results;
};

/**
 * Process trend data into time-series format
 * @param data - Raw trend data
 * @param filter - Analytics filter
 * @returns Processed time-series data points
 */
const processTrendData = (
  data: number[],
  filter: AnalyticsFilter
): TrendAnalysis['dataPoints'] => {
  const interval = getTimeInterval(filter.timeRange);
  const startTime = filter.startDate.getTime();

  return data.map((value, index) => ({
    timestamp: new Date(startTime + (index * interval)),
    value
  }));
};

/**
 * Get time interval in milliseconds based on time range
 * @param timeRange - Selected time range
 * @returns Interval in milliseconds
 */
const getTimeInterval = (timeRange: TimeRange): number => {
  const DAY = 24 * 60 * 60 * 1000;
  const intervals: Record<TimeRange, number> = {
    [TimeRange.DAY]: DAY / 24, // hourly
    [TimeRange.WEEK]: DAY, // daily
    [TimeRange.MONTH]: DAY, // daily
    [TimeRange.QUARTER]: DAY * 7, // weekly
    [TimeRange.YEAR]: DAY * 30 // monthly
  };
  return intervals[timeRange];
};

// Export analytics service functions
export const AnalyticsService = {
  fetchTeamAnalytics,
  compareTeams,
  getMetricHistory,
  calculateGrowthRate
};