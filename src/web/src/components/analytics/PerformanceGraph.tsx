/**
 * @fileoverview Performance Graph Component for CodeQuest Analytics
 * Renders optimized, accessible performance visualizations with real-time updates
 * and enhanced error handling.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react'; // v18.0.0
import {
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts'; // v2.7.0
import { useAnalytics } from '../../hooks/useAnalytics';
import type {
  MetricType,
  TimeRange,
  ChartConfig
} from '../../types/analytics.types';

/**
 * Props interface for the PerformanceGraph component
 */
interface PerformanceGraphProps {
  /** Team identifier for data fetching */
  teamId: string;
  /** Chart configuration options */
  config: ChartConfig;
  /** Optional CSS class name */
  className?: string;
  /** Optional height override (default: 400px) */
  height?: number;
  /** Optional animation toggle */
  enableAnimation?: boolean;
  /** Optional accessibility labels */
  accessibilityLabels?: {
    title?: string;
    description?: string;
  };
  /** Optional callback when data loads */
  onDataLoad?: (data: any) => void;
  /** Optional error callback */
  onError?: (error: Error) => void;
}

/**
 * Interface for formatted chart data points
 */
interface ChartDataPoint {
  timestamp: string;
  value: number;
  previousValue?: number;
}

/**
 * Performance Graph Component
 * Renders an optimized performance visualization with accessibility support
 */
export const PerformanceGraph: React.FC<PerformanceGraphProps> = ({
  teamId,
  config,
  className = '',
  height = 400,
  enableAnimation = true,
  accessibilityLabels = {},
  onDataLoad,
  onError
}) => {
  // Analytics hook for data fetching
  const { getMetricTrend, loading, error } = useAnalytics();
  
  // Local state for chart data
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  /**
   * Formats raw metric data for chart display
   */
  const formatChartData = useCallback((
    values: number[],
    labels: string[],
    previousValues?: number[]
  ): ChartDataPoint[] => {
    return labels.map((label, index) => ({
      timestamp: label,
      value: values[index],
      ...(previousValues && { previousValue: previousValues[index] })
    }));
  }, []);

  /**
   * Memoized chart configuration with performance optimizations
   */
  const chartConfig = useMemo(() => ({
    margin: { top: 20, right: 30, left: 20, bottom: 20 },
    animationDuration: enableAnimation ? 300 : 0,
    stroke: '#1976D2',
    strokeWidth: 2,
    dot: { r: 3 },
    activeDot: { r: 5 },
    previousPeriodStroke: '#757575',
    gridColor: '#f5f5f5'
  }), [enableAnimation]);

  /**
   * Custom tooltip formatter for accessibility
   */
  const tooltipFormatter = useCallback((value: number) => {
    return [`${value.toLocaleString()}`, config.metric];
  }, [config.metric]);

  /**
   * Fetches and processes chart data
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { values, labels } = await getMetricTrend(
          teamId,
          config.metric,
          config.timeRange
        );

        let formattedData: ChartDataPoint[];

        if (config.compareWithPrevious) {
          // Fetch previous period data for comparison
          const previousPeriod = await getMetricTrend(
            teamId,
            config.metric,
            config.timeRange
          );
          formattedData = formatChartData(values, labels, previousPeriod.values);
        } else {
          formattedData = formatChartData(values, labels);
        }

        setChartData(formattedData);
        onDataLoad?.(formattedData);
      } catch (err) {
        onError?.(err as Error);
      }
    };

    fetchData();
  }, [teamId, config, getMetricTrend, formatChartData, onDataLoad, onError]);

  // Error handling
  if (error) {
    return (
      <div className={`performance-graph-error ${className}`} role="alert">
        <p>Failed to load performance data: {error.message}</p>
      </div>
    );
  }

  // Loading state
  if (loading && !chartData.length) {
    return (
      <div className={`performance-graph-loading ${className}`} role="status">
        <p>Loading performance data...</p>
      </div>
    );
  }

  return (
    <div 
      className={`performance-graph ${className}`}
      role="region"
      aria-label={accessibilityLabels.title || 'Performance Graph'}
    >
      <ResponsiveContainer width="100%" height={height}>
        <Line
          data={chartData}
          margin={chartConfig.margin}
          aria-label={accessibilityLabels.description}
        >
          {/* Primary metric line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={chartConfig.stroke}
            strokeWidth={chartConfig.strokeWidth}
            dot={chartConfig.dot}
            activeDot={chartConfig.activeDot}
            isAnimationActive={enableAnimation}
            animationDuration={chartConfig.animationDuration}
          />

          {/* Comparison line (if enabled) */}
          {config.compareWithPrevious && (
            <Line
              type="monotone"
              dataKey="previousValue"
              stroke={chartConfig.previousPeriodStroke}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={enableAnimation}
              animationDuration={chartConfig.animationDuration}
            />
          )}

          {/* Axes */}
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            stroke="#9e9e9e"
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#9e9e9e"
            tickLine={false}
            width={60}
          />

          {/* Interactive elements */}
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{ background: '#fff', border: '1px solid #e0e0e0' }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => config.metric}
          />
        </Line>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceGraph;