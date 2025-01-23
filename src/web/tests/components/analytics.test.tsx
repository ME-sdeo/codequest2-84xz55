import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { vi } from 'vitest';
import { AnalyticsChart } from '../../src/components/analytics/AnalyticsChart';
import { MetricsCard } from '../../src/components/analytics/MetricsCard';
import { PerformanceGraph } from '../../src/components/analytics/PerformanceGraph';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { MetricType, TimeRange } from '../../src/types/analytics.types';

// Mock useAnalytics hook
vi.mock('../../src/hooks/useAnalytics', () => ({
  useAnalytics: vi.fn()
}));

// Mock data for testing
const mockMetricData = {
  type: MetricType.TOTAL_POINTS,
  value: 2450,
  change: 15.5,
  trend: [2100, 2200, 2300, 2450]
};

const mockChartConfig = {
  type: 'line',
  metric: MetricType.TOTAL_POINTS,
  timeRange: TimeRange.MONTH,
  compareWithPrevious: false
};

describe('AnalyticsChart', () => {
  beforeEach(() => {
    vi.mocked(useAnalytics).mockReturnValue({
      getMetricTrend: vi.fn().mockResolvedValue({
        values: [100, 200, 300, 400],
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      }),
      loading: false,
      error: null
    });
  });

  it('renders chart with correct data', async () => {
    render(
      <AnalyticsChart
        teamId="team-123"
        config={mockChartConfig}
        height="400px"
        width="100%"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('handles loading state correctly', () => {
    vi.mocked(useAnalytics).mockReturnValue({
      getMetricTrend: vi.fn(),
      loading: true,
      error: null
    });

    render(
      <AnalyticsChart
        teamId="team-123"
        config={mockChartConfig}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading chart data...');
  });

  it('handles error state correctly', () => {
    vi.mocked(useAnalytics).mockReturnValue({
      getMetricTrend: vi.fn(),
      loading: false,
      error: new Error('Failed to load chart')
    });

    render(
      <AnalyticsChart
        teamId="team-123"
        config={mockChartConfig}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load chart');
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <AnalyticsChart
        teamId="team-123"
        config={mockChartConfig}
        a11y={{ enableKeyboardNavigation: true }}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', async () => {
    render(
      <AnalyticsChart
        teamId="team-123"
        config={mockChartConfig}
        a11y={{ enableKeyboardNavigation: true }}
      />
    );

    const chart = screen.getByRole('img');
    chart.focus();
    fireEvent.keyDown(chart, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(chart).toHaveAttribute('aria-label');
    });
  });
});

describe('MetricsCard', () => {
  it('renders metric value and trend correctly', () => {
    render(
      <MetricsCard
        metric={mockMetricData}
        title="Total Points"
        description="Team performance metric"
      />
    );

    expect(screen.getByText('2,450')).toBeInTheDocument();
    expect(screen.getByText('15.5%')).toBeInTheDocument();
  });

  it('handles click interactions', async () => {
    const handleClick = vi.fn();
    render(
      <MetricsCard
        metric={mockMetricData}
        title="Total Points"
        onClick={handleClick}
      />
    );

    await userEvent.click(screen.getByRole('article'));
    expect(handleClick).toHaveBeenCalledWith(mockMetricData);
  });

  it('displays trend indicator correctly', () => {
    render(
      <MetricsCard
        metric={{ ...mockMetricData, change: -10.5 }}
        title="Total Points"
      />
    );

    expect(screen.getByTestId('TrendingDownIcon')).toBeInTheDocument();
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <MetricsCard
        metric={mockMetricData}
        title="Total Points"
        ariaLabel="Total points metric card"
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('PerformanceGraph', () => {
  beforeEach(() => {
    vi.mocked(useAnalytics).mockReturnValue({
      getMetricTrend: vi.fn().mockResolvedValue({
        values: [100, 200, 300, 400],
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      }),
      loading: false,
      error: null
    });
  });

  it('renders performance graph with data', async () => {
    render(
      <PerformanceGraph
        teamId="team-123"
        config={mockChartConfig}
        height={400}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('handles comparison mode correctly', async () => {
    render(
      <PerformanceGraph
        teamId="team-123"
        config={{ ...mockChartConfig, compareWithPrevious: true }}
      />
    );

    await waitFor(() => {
      expect(vi.mocked(useAnalytics).mock.calls.length).toBe(2);
    });
  });

  it('handles loading and error states', () => {
    vi.mocked(useAnalytics).mockReturnValue({
      getMetricTrend: vi.fn(),
      loading: true,
      error: null
    });

    render(
      <PerformanceGraph
        teamId="team-123"
        config={mockChartConfig}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading performance data...');
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <PerformanceGraph
        teamId="team-123"
        config={mockChartConfig}
        accessibilityLabels={{
          title: 'Performance Trends',
          description: 'Team performance over time'
        }}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('calls callbacks on data load and error', async () => {
    const onDataLoad = vi.fn();
    const onError = vi.fn();

    render(
      <PerformanceGraph
        teamId="team-123"
        config={mockChartConfig}
        onDataLoad={onDataLoad}
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(onDataLoad).toHaveBeenCalled();
    });
  });
});