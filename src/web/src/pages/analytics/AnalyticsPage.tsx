/**
 * @fileoverview Analytics Page Component for CodeQuest
 * Displays comprehensive team performance metrics, historical trends, and comparative analytics
 * with real-time updates and accessibility features.
 * @version 1.0.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Grid, Typography, Select, useTheme } from '@mui/material';
import AnalyticsChart from '../../components/analytics/AnalyticsChart';
import MetricsCard from '../../components/analytics/MetricsCard';
import PerformanceGraph from '../../components/analytics/PerformanceGraph';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { 
  MetricType, 
  TimeRange, 
  MetricFilter, 
  ViewMode 
} from '../../types/analytics.types';

/**
 * Props interface for AnalyticsPage component
 */
interface AnalyticsPageProps {
  teamId: string;
  organizationId: string;
  viewMode: ViewMode;
  customMetrics?: MetricConfig[];
}

/**
 * Interface for metric configuration
 */
interface MetricConfig {
  type: MetricType;
  timeRange: TimeRange;
  compareTeams: string[];
  includeAIGenerated: boolean;
  sortOrder: 'asc' | 'desc';
}

/**
 * Analytics Page Component
 * Renders comprehensive analytics dashboard with real-time updates
 */
const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  teamId,
  organizationId,
  viewMode,
  customMetrics = []
}) => {
  const theme = useTheme();
  const {
    loading,
    error,
    teamMetrics,
    fetchTeamMetrics,
    compareTeamMetrics,
    isStale
  } = useAnalytics();

  // Local state for filters and view options
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.MONTH);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>([
    MetricType.TOTAL_POINTS,
    MetricType.ACTIVITY_COUNT,
    MetricType.AI_DETECTION_RATE
  ]);

  // Memoized filter configuration
  const metricFilter = useMemo<MetricFilter>(() => ({
    timeRange,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date(),
    includeAIGenerated: true,
    sortOrder: 'desc'
  }), [timeRange]);

  // Effect for initial data fetch and real-time updates
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchTeamMetrics(teamId, metricFilter);
        
        // Set up real-time updates
        const updateInterval = setInterval(() => {
          if (isStale) {
            fetchTeamMetrics(teamId, metricFilter);
          }
        }, 30000); // 30 seconds

        return () => clearInterval(updateInterval);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      }
    };

    fetchData();
  }, [teamId, metricFilter, fetchTeamMetrics, isStale]);

  // Memoized chart configurations
  const chartConfigs = useMemo(() => ({
    performance: {
      type: 'line',
      metric: MetricType.TOTAL_POINTS,
      timeRange,
      compareWithPrevious: true
    },
    activities: {
      type: 'bar',
      metric: MetricType.ACTIVITY_COUNT,
      timeRange,
      compareWithPrevious: false
    },
    aiDetection: {
      type: 'area',
      metric: MetricType.AI_DETECTION_RATE,
      timeRange,
      compareWithPrevious: true
    }
  }), [timeRange]);

  // Error handling
  if (error) {
    return (
      <div role="alert" className="analytics-error">
        <Typography color="error" variant="h6">
          Error loading analytics: {error.message}
        </Typography>
      </div>
    );
  }

  return (
    <div 
      className="analytics-page"
      role="main"
      aria-label="Team Analytics Dashboard"
    >
      {/* Header Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Typography variant="h4" component="h1" gutterBottom>
            Team Analytics
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Performance metrics and insights for your team
          </Typography>
        </Grid>

        {/* Filter Controls */}
        <Grid item xs={12} sm={6} md={4}>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            fullWidth
            aria-label="Time Range Filter"
          >
            {Object.values(TimeRange).map((range) => (
              <option key={range} value={range}>
                {range.toLowerCase()}
              </option>
            ))}
          </Select>
        </Grid>
      </Grid>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {selectedMetrics.map((metricType) => (
          <Grid item xs={12} sm={6} md={4} key={metricType}>
            <MetricsCard
              metric={teamMetrics?.metrics[metricType] || {
                type: metricType,
                value: 0,
                change: 0,
                trend: []
              }}
              title={metricType.replace(/_/g, ' ')}
              description={`Current ${metricType.toLowerCase()} metrics`}
              ariaLabel={`${metricType.toLowerCase()} metric card`}
            />
          </Grid>
        ))}
      </Grid>

      {/* Performance Graphs */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <PerformanceGraph
            teamId={teamId}
            config={chartConfigs.performance}
            height={400}
            enableAnimation={true}
            accessibilityLabels={{
              title: 'Team Performance Trend',
              description: 'Graph showing team performance over time'
            }}
            onError={(err) => console.error('Performance graph error:', err)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <AnalyticsChart
            teamId={teamId}
            config={chartConfigs.activities}
            height="300px"
            theme={{
              backgroundColor: [theme.palette.primary.light],
              borderColor: [theme.palette.primary.main]
            }}
            a11y={{
              enableKeyboardNavigation: true,
              announceDataPoints: true,
              ariaLabel: 'Activity Distribution Chart'
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <AnalyticsChart
            teamId={teamId}
            config={chartConfigs.aiDetection}
            height="300px"
            theme={{
              backgroundColor: [theme.palette.secondary.light],
              borderColor: [theme.palette.secondary.main]
            }}
            a11y={{
              enableKeyboardNavigation: true,
              announceDataPoints: true,
              ariaLabel: 'AI Detection Rate Chart'
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
};

export default AnalyticsPage;