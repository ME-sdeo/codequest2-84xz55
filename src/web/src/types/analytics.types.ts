/**
 * @fileoverview TypeScript type definitions for analytics data structures and visualizations.
 * Provides comprehensive types for tracking team performance metrics, comparisons, and historical trends.
 * @version 1.0.0
 */

import { BaseEntity, TenantEntity } from './common.types';
import { ActivityType } from './activity.types';

/**
 * Time range options for analytics period selection.
 * Supports flexible time-based analysis of metrics.
 */
export enum TimeRange {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR'
}

/**
 * Available metric types for analytics calculations and visualization.
 * Core metrics tracked across the platform.
 */
export enum MetricType {
  TOTAL_POINTS = 'TOTAL_POINTS',
  ACTIVITY_COUNT = 'ACTIVITY_COUNT',
  AI_DETECTION_RATE = 'AI_DETECTION_RATE',
  AVERAGE_POINTS = 'AVERAGE_POINTS'
}

/**
 * Filter criteria for analytics queries.
 * Supports comprehensive filtering with immutable arrays for type safety.
 */
export interface AnalyticsFilter {
  /** Selected time range for analysis */
  timeRange: TimeRange;
  /** Start date for custom date range */
  startDate: Date;
  /** End date for custom date range */
  endDate: Date;
  /** Selected activity types to analyze */
  activityTypes: readonly ActivityType[];
  /** Teams to include in analysis */
  teamIds: readonly string[];
}

/**
 * Structure for metric values with trend data.
 * Includes current value, change from previous period, and historical trend.
 */
export interface MetricValue {
  /** Type of metric being measured */
  type: MetricType;
  /** Current value of the metric */
  value: number;
  /** Percentage change from previous period */
  change: number;
  /** Historical trend values for visualization */
  trend: readonly number[];
}

/**
 * Summary of individual contributor metrics.
 * Tracks key performance indicators per team member.
 */
export interface ContributorSummary {
  /** Unique identifier of the contributor */
  userId: string;
  /** Total points earned by the contributor */
  totalPoints: number;
  /** Total number of activities performed */
  activityCount: number;
  /** Percentage of AI-generated activities */
  aiGeneratedRate: number;
}

/**
 * Comprehensive team analytics data structure.
 * Combines all metrics and breakdowns for team performance analysis.
 */
export interface TeamAnalytics extends BaseEntity, TenantEntity {
  /** Unique identifier of the team */
  teamId: string;
  /** Collection of metrics for the team */
  metrics: Readonly<Record<MetricType, MetricValue>>;
  /** Breakdown of activities by type */
  activityBreakdown: Readonly<Record<ActivityType, number>>;
  /** List of top contributors in the team */
  topContributors: readonly ContributorSummary[];
}

/**
 * Configuration for analytics chart visualization components.
 * Controls how metrics are displayed in the UI.
 */
export interface ChartConfig {
  /** Type of chart (e.g., 'line', 'bar', 'pie') */
  type: string;
  /** Metric to display in the chart */
  metric: MetricType;
  /** Time range for data display */
  timeRange: TimeRange;
  /** Flag to enable comparison with previous period */
  compareWithPrevious: boolean;
}

/**
 * Interface for historical trend analysis.
 * Supports tracking changes over time with proper typing.
 */
export interface TrendAnalysis {
  /** Time period for the trend */
  period: TimeRange;
  /** Series of data points */
  dataPoints: readonly {
    /** Timestamp for the data point */
    timestamp: Date;
    /** Value at this point in time */
    value: number;
  }[];
}

/**
 * Interface for team comparison data.
 * Enables direct comparison between multiple teams.
 */
export interface TeamComparison {
  /** Base team for comparison */
  baseTeamId: string;
  /** Teams being compared */
  comparisonTeamIds: readonly string[];
  /** Metrics being compared */
  metrics: readonly MetricType[];
  /** Comparison results per metric */
  results: Readonly<Record<MetricType, {
    /** Values for each team */
    values: Readonly<Record<string, number>>;
    /** Percentage differences from base team */
    differences: Readonly<Record<string, number>>;
  }>>;
}