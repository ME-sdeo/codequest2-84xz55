/**
 * @fileoverview A React component that renders an accessible, real-time visual chart 
 * displaying user points history, level progression, and activity trends.
 * @version 1.0.0
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ChartOptions } from 'chart.js'; // v4.0.0
import { Line } from 'react-chartjs-2'; // v5.0.0
import { useTheme, styled } from '@mui/material/styles'; // v5.0.0
import { useMediaQuery, CircularProgress } from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import { usePoints } from '../../hooks/usePoints';
import Card from '../common/Card';
import { formatPoints } from '../../utils/points.utils';
import { ActivityType } from '../../types/activity.types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Styled components
const ChartContainer = styled('div')(({ theme }) => ({
  minHeight: '300px',
  padding: theme.spacing(2),
  position: 'relative',
  touchAction: 'pan-y pinch-zoom',
  outline: 'none',
  tabIndex: 0,
}));

const LoadingOverlay = styled('div')({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(var(--background-rgb), 0.7)',
});

// Component props interface
interface PointsChartProps {
  teamMemberId: string;
  timeRange: string;
  height?: number;
  className?: string;
  onDataUpdate?: (points: number) => void;
  accessibilityLabel?: string;
}

/**
 * Custom hook for chart configuration with theme and accessibility support
 */
const useChartConfig = (theme: any, reducedMotion: boolean) => {
  return useMemo((): ChartOptions => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: reducedMotion ? 0 : 750,
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: theme.palette.text.primary,
          font: {
            family: theme.typography.fontFamily,
          },
        },
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (context: any) => {
            return `Points: ${formatPoints(context.raw)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: theme.palette.divider,
        },
        ticks: {
          color: theme.palette.text.secondary,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: theme.palette.divider,
        },
        ticks: {
          color: theme.palette.text.secondary,
          callback: (value: number) => formatPoints(value),
        },
      },
    },
  }), [theme, reducedMotion]);
};

/**
 * PointsChart component for visualizing points history and trends
 */
const PointsChart = React.memo<PointsChartProps>(({
  teamMemberId,
  timeRange,
  height = 300,
  className,
  onDataUpdate,
  accessibilityLabel = 'Points history chart',
}) => {
  const theme = useTheme();
  const chartRef = useRef<ChartJS>(null);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  
  const {
    getPointsHistory,
    getLevelProgress,
    loading,
    error,
    wsStatus,
  } = usePoints(teamMemberId, {
    enableRealTime: true,
    cacheResults: true,
    retryOnFailure: true,
  });

  const chartConfig = useChartConfig(theme, prefersReducedMotion);

  // Fetch and process chart data
  const fetchData = useCallback(async () => {
    try {
      const [history, levelProgress] = await Promise.all([
        getPointsHistory(),
        getLevelProgress(),
      ]);

      if (onDataUpdate && history.length > 0) {
        onDataUpdate(history[0].points);
      }

      return { history, levelProgress };
    } catch (err) {
      console.error('Error fetching chart data:', err);
      return { history: [], levelProgress: null };
    }
  }, [getPointsHistory, getLevelProgress, onDataUpdate]);

  // Process chart data
  const chartData = useMemo(() => {
    const labels = Array.from({ length: 30 }, (_, i) => 
      new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString()
    ).reverse();

    return {
      labels,
      datasets: [
        {
          label: 'Total Points',
          data: Array(30).fill(0), // Placeholder until real data arrives
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.primary.light,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
        {
          label: 'AI-Generated',
          data: Array(30).fill(0), // Placeholder until real data arrives
          borderColor: theme.palette.secondary.main,
          backgroundColor: theme.palette.secondary.light,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
      ],
    };
  }, [theme]);

  // Initialize chart and data
  useEffect(() => {
    fetchData();
    
    // Cleanup chart instance on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [fetchData, teamMemberId, timeRange]);

  // Handle errors with error boundary
  const handleError = (error: Error) => {
    console.error('Chart error:', error);
    return (
      <Card elevated className={className}>
        <div role="alert">
          Failed to load chart. Please try again later.
        </div>
      </Card>
    );
  };

  return (
    <ErrorBoundary fallback={handleError}>
      <Card 
        elevated 
        className={className}
        role="region"
        aria-label={accessibilityLabel}
      >
        <ChartContainer style={{ height }}>
          <Line
            ref={chartRef}
            data={chartData}
            options={chartConfig}
            aria-label={accessibilityLabel}
          />
          {loading && (
            <LoadingOverlay>
              <CircularProgress aria-label="Loading chart data" />
            </LoadingOverlay>
          )}
        </ChartContainer>
      </Card>
    </ErrorBoundary>
  );
});

PointsChart.displayName = 'PointsChart';

export default PointsChart;