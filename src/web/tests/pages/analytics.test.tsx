import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import '@testing-library/jest-dom';

import AnalyticsPage from '../../src/pages/analytics/AnalyticsPage';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { createAppTheme } from '../../src/config/theme.config';
import { MetricType, TimeRange } from '../../src/types/analytics.types';

// Mock the analytics hook
vi.mock('../../src/hooks/useAnalytics');

// Mock data for testing
const mockMetrics = {
  metrics: {
    [MetricType.TOTAL_POINTS]: {
      type: MetricType.TOTAL_POINTS,
      value: 2450,
      change: 15.5,
      trend: [2100, 2200, 2300, 2450]
    },
    [MetricType.ACTIVITY_COUNT]: {
      type: MetricType.ACTIVITY_COUNT,
      value: 156,
      change: -5.2,
      trend: [170, 165, 160, 156]
    },
    [MetricType.AI_DETECTION_RATE]: {
      type: MetricType.AI_DETECTION_RATE,
      value: 25.5,
      change: 2.3,
      trend: [22, 23, 24, 25.5]
    }
  }
};

// Test utils
const renderWithProvider = (ui: React.ReactElement) => {
  const mockStore = {
    getState: () => ({
      analytics: {
        teamAnalytics: [mockMetrics],
        currentFilter: null,
        loadingStates: {},
        errors: {},
        cache: {}
      }
    }),
    dispatch: vi.fn(),
    subscribe: vi.fn()
  };

  return render(
    <Provider store={mockStore}>
      {ui}
    </Provider>
  );
};

describe('AnalyticsPage', () => {
  const mockFetchTeamMetrics = vi.fn();
  const mockCompareTeamMetrics = vi.fn();
  const mockGetMetricTrend = vi.fn();
  const mockSubscribeToUpdates = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAnalytics as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      teamMetrics: mockMetrics,
      fetchTeamMetrics: mockFetchTeamMetrics,
      compareTeamMetrics: mockCompareTeamMetrics,
      getMetricTrend: mockGetMetricTrend,
      subscribeToUpdates: mockSubscribeToUpdates,
      isStale: false
    });
  });

  describe('Initial Rendering', () => {
    it('should render the analytics page with correct title', () => {
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      expect(screen.getByRole('main')).toHaveAttribute(
        'aria-label',
        'Team Analytics Dashboard'
      );
      expect(screen.getByText('Team Analytics')).toBeInTheDocument();
    });

    it('should fetch initial metrics data on mount', async () => {
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      await waitFor(() => {
        expect(mockFetchTeamMetrics).toHaveBeenCalledWith(
          'team-123',
          expect.any(Object)
        );
      });
    });
  });

  describe('Performance Metrics Display', () => {
    it('should display all required metric cards', () => {
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      expect(screen.getByText('TOTAL POINTS')).toBeInTheDocument();
      expect(screen.getByText('ACTIVITY COUNT')).toBeInTheDocument();
      expect(screen.getByText('AI DETECTION RATE')).toBeInTheDocument();
    });

    it('should update metrics within 2-second SLA', async () => {
      const startTime = performance.now();
      
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2,450')).toBeInTheDocument();
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe('Team Comparisons', () => {
    it('should handle team comparison data correctly', async () => {
      mockCompareTeamMetrics.mockResolvedValue([
        mockMetrics,
        { ...mockMetrics, metrics: { ...mockMetrics.metrics, TOTAL_POINTS: { value: 2000 }}}
      ]);

      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="comparison"
        />
      );

      await waitFor(() => {
        expect(mockCompareTeamMetrics).toHaveBeenCalled();
      });
    });

    it('should display comparative metrics with proper visualization', async () => {
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="comparison"
        />
      );

      const performanceGraph = screen.getByRole('region', { name: /performance graph/i });
      expect(performanceGraph).toBeInTheDocument();
    });
  });

  describe('Historical Trending', () => {
    it('should display historical trend data correctly', async () => {
      mockGetMetricTrend.mockResolvedValue({
        values: [2100, 2200, 2300, 2450],
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      });

      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      await waitFor(() => {
        expect(mockGetMetricTrend).toHaveBeenCalled();
      });
    });

    it('should allow time range selection', async () => {
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      const timeRangeSelect = screen.getByRole('combobox', { name: /time range filter/i });
      fireEvent.change(timeRangeSelect, { target: { value: TimeRange.MONTH }});

      await waitFor(() => {
        expect(mockFetchTeamMetrics).toHaveBeenCalledWith(
          'team-123',
          expect.objectContaining({ timeRange: TimeRange.MONTH })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when data fetch fails', async () => {
      (useAnalytics as jest.Mock).mockReturnValue({
        loading: false,
        error: { message: 'Failed to fetch analytics data' },
        teamMetrics: null,
        fetchTeamMetrics: mockFetchTeamMetrics
      });

      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to fetch analytics data'
      );
    });

    it('should retry failed requests automatically', async () => {
      mockFetchTeamMetrics
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockMetrics);

      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      await waitFor(() => {
        expect(mockFetchTeamMetrics).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('should pass accessibility checks', async () => {
      const { container } = renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', () => {
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      const timeRangeSelect = screen.getByRole('combobox', { name: /time range filter/i });
      timeRangeSelect.focus();
      expect(document.activeElement).toBe(timeRangeSelect);
    });

    it('should have proper ARIA labels', () => {
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      const metricCards = screen.getAllByRole('article');
      metricCards.forEach(card => {
        expect(card).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should subscribe to real-time updates', () => {
      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      expect(mockSubscribeToUpdates).toHaveBeenCalled();
    });

    it('should update metrics when new data arrives', async () => {
      const updatedMetrics = {
        ...mockMetrics,
        metrics: {
          ...mockMetrics.metrics,
          [MetricType.TOTAL_POINTS]: {
            ...mockMetrics.metrics[MetricType.TOTAL_POINTS],
            value: 2500
          }
        }
      };

      (useAnalytics as jest.Mock)
        .mockReturnValueOnce({
          loading: false,
          error: null,
          teamMetrics: mockMetrics,
          fetchTeamMetrics: mockFetchTeamMetrics,
          isStale: false
        })
        .mockReturnValueOnce({
          loading: false,
          error: null,
          teamMetrics: updatedMetrics,
          fetchTeamMetrics: mockFetchTeamMetrics,
          isStale: false
        });

      renderWithProvider(
        <AnalyticsPage 
          teamId="team-123"
          organizationId="org-123"
          viewMode="default"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2,500')).toBeInTheDocument();
      });
    });
  });
});