/**
 * @fileoverview A reusable React component for rendering analytics charts
 * Supports various metrics, time ranges, and comparison views with optimized performance
 * @version 1.0.0
 */

import React, { useEffect, useRef, useMemo } from 'react'; // v18.0.0
import { Chart, ChartConfiguration, ChartOptions } from 'chart.js'; // v4.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { useAnalytics } from '../../hooks/useAnalytics';
import type { ChartConfig, MetricType, TimeRange } from '../../types/analytics.types';

// Constants for chart configuration
const CHART_UPDATE_DELAY = 500;
const DEFAULT_HEIGHT = '400px';
const DEFAULT_WIDTH = '100%';

/**
 * Interface for chart theme configuration
 */
interface ThemeConfig {
  backgroundColor: string[];
  borderColor: string[];
  gridColor: string;
  textColor: string;
  fontFamily: string;
}

/**
 * Interface for accessibility configuration
 */
interface AccessibilityConfig {
  enableKeyboardNavigation: boolean;
  announceDataPoints: boolean;
  ariaLabel: string;
}

/**
 * Props interface for the AnalyticsChart component
 */
interface AnalyticsChartProps {
  teamId: string;
  config: ChartConfig;
  className?: string;
  height?: string;
  width?: string;
  enableAnimation?: boolean;
  theme?: Partial<ThemeConfig>;
  a11y?: Partial<AccessibilityConfig>;
  fallback?: React.ReactNode;
}

/**
 * Default theme configuration
 */
const defaultTheme: ThemeConfig = {
  backgroundColor: ['rgba(25, 118, 210, 0.2)', 'rgba(66, 66, 66, 0.2)'],
  borderColor: ['rgb(25, 118, 210)', 'rgb(66, 66, 66)'],
  gridColor: 'rgba(0, 0, 0, 0.1)',
  textColor: '#424242',
  fontFamily: 'Inter, system-ui, sans-serif'
};

/**
 * Default accessibility configuration
 */
const defaultA11y: AccessibilityConfig = {
  enableKeyboardNavigation: true,
  announceDataPoints: true,
  ariaLabel: 'Analytics Chart'
};

/**
 * Custom hook for generating memoized chart options
 */
const useChartOptions = (
  metricType: MetricType,
  theme: ThemeConfig,
  a11y: AccessibilityConfig
): ChartOptions => {
  return useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            family: theme.fontFamily,
            size: 12
          },
          color: theme.textColor
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: theme.textColor,
        bodyColor: theme.textColor,
        borderColor: theme.gridColor,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          color: theme.gridColor,
          drawBorder: false
        },
        ticks: {
          color: theme.textColor,
          font: {
            family: theme.fontFamily
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: theme.gridColor,
          drawBorder: false
        },
        ticks: {
          color: theme.textColor,
          font: {
            family: theme.fontFamily
          }
        }
      }
    }
  }), [metricType, theme]);
};

/**
 * AnalyticsChart component for rendering various types of analytics visualizations
 */
export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  teamId,
  config,
  className = '',
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  enableAnimation = true,
  theme: customTheme = {},
  a11y: customA11y = {},
  fallback = <div>Error loading chart</div>
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const { getMetricTrend, loading, error } = useAnalytics();

  // Merge custom configurations with defaults
  const theme = { ...defaultTheme, ...customTheme };
  const a11y = { ...defaultA11y, ...customA11y };

  // Get memoized chart options
  const chartOptions = useChartOptions(config.metric, theme, a11y);

  // Debounce the config changes to prevent excessive updates
  const [debouncedConfig] = useDebounce(config, CHART_UPDATE_DELAY);

  useEffect(() => {
    const fetchAndUpdateChart = async () => {
      if (!chartRef.current) return;

      try {
        const { values, labels } = await getMetricTrend(
          teamId,
          config.metric,
          config.timeRange
        );

        const chartConfig: ChartConfiguration = {
          type: config.type,
          data: {
            labels,
            datasets: [{
              label: config.metric,
              data: values,
              backgroundColor: theme.backgroundColor[0],
              borderColor: theme.borderColor[0],
              borderWidth: 2,
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            ...chartOptions,
            animation: enableAnimation
          }
        };

        if (config.compareWithPrevious) {
          // Add previous period comparison dataset
          const previousPeriod = await getMetricTrend(
            teamId,
            config.metric,
            config.timeRange
          );

          chartConfig.data.datasets.push({
            label: `Previous ${config.timeRange}`,
            data: previousPeriod.values,
            backgroundColor: theme.backgroundColor[1],
            borderColor: theme.borderColor[1],
            borderWidth: 2,
            tension: 0.4,
            fill: true
          });
        }

        // Update or create chart instance
        if (chartInstance.current) {
          chartInstance.current.data = chartConfig.data;
          chartInstance.current.options = chartConfig.options;
          chartInstance.current.update('none');
        } else {
          chartInstance.current = new Chart(chartRef.current, chartConfig);
        }
      } catch (err) {
        console.error('Error updating chart:', err);
      }
    };

    fetchAndUpdateChart();

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [debouncedConfig, teamId, theme, enableAnimation]);

  // Add keyboard navigation for accessibility
  useEffect(() => {
    if (!a11y.enableKeyboardNavigation || !chartRef.current) return;

    const handleKeyboard = (e: KeyboardEvent) => {
      if (!chartInstance.current) return;

      const activeElements = chartInstance.current.getActiveElements();
      if (activeElements.length === 0) return;

      const currentIndex = activeElements[0].index;
      const dataLength = chartInstance.current.data.labels?.length || 0;

      switch (e.key) {
        case 'ArrowLeft':
          chartInstance.current.setActiveElements([{
            datasetIndex: 0,
            index: Math.max(0, currentIndex - 1)
          }]);
          break;
        case 'ArrowRight':
          chartInstance.current.setActiveElements([{
            datasetIndex: 0,
            index: Math.min(dataLength - 1, currentIndex + 1)
          }]);
          break;
      }
      chartInstance.current.update();
    };

    chartRef.current.addEventListener('keydown', handleKeyboard);
    return () => {
      chartRef.current?.removeEventListener('keydown', handleKeyboard);
    };
  }, [a11y.enableKeyboardNavigation]);

  if (error) {
    return <div role="alert" className="chart-error">{error.message}</div>;
  }

  return (
    <ErrorBoundary fallback={fallback}>
      <div 
        className={`analytics-chart ${className}`}
        style={{ height, width }}
      >
        {loading && (
          <div className="chart-loading" role="status">
            Loading chart data...
          </div>
        )}
        <canvas
          ref={chartRef}
          role="img"
          aria-label={a11y.ariaLabel}
          tabIndex={a11y.enableKeyboardNavigation ? 0 : -1}
        />
      </div>
    </ErrorBoundary>
  );
};

export default AnalyticsChart;