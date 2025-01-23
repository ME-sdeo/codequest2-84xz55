import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { jest } from '@jest/globals'; // v29.0.0
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { AnalyticsService } from '../../src/services/analytics.service';
import { MetricType, TimeRange } from '../../src/types/analytics.types';

// Mock the analytics service
jest.mock('../../src/services/analytics.service');

// Mock Redux store
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: jest.fn((selector) => selector({
    analytics: {
      teamAnalytics: [],
      cache: {},
      currentFilter: null
    }
  })),
  useDispatch: () => mockDispatch
}));

describe('useAnalytics', () => {
  const mockTeamId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFilter = {
    timeRange: TimeRange.MONTH,
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-31'),
    activityTypes: ['CODE_REVIEW', 'PULL_REQUEST'],
    teamIds: [mockTeamId]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Team Metrics', () => {
    const mockTeamAnalytics = {
      teamId: mockTeamId,
      metrics: {
        [MetricType.TOTAL_POINTS]: {
          value: 1000,
          change: 10,
          trend: [900, 950, 1000]
        }
      }
    };

    beforeEach(() => {
      (AnalyticsService.fetchTeamAnalytics as jest.Mock).mockResolvedValue(mockTeamAnalytics);
    });

    it('should fetch team metrics successfully', async () => {
      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        await result.current.fetchTeamMetrics(mockTeamId, mockFilter);
      });

      expect(AnalyticsService.fetchTeamAnalytics).toHaveBeenCalledWith(mockTeamId, mockFilter);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(100);
    });

    it('should handle cache hits correctly', async () => {
      const { result } = renderHook(() => useAnalytics());
      
      // First call to populate cache
      await act(async () => {
        await result.current.fetchTeamMetrics(mockTeamId, mockFilter);
      });

      // Reset mock to verify cache hit
      (AnalyticsService.fetchTeamAnalytics as jest.Mock).mockClear();

      // Second call should use cache
      await act(async () => {
        await result.current.fetchTeamMetrics(mockTeamId, mockFilter);
      });

      expect(AnalyticsService.fetchTeamAnalytics).not.toHaveBeenCalled();
      expect(result.current.progress).toBe(100);
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('API Error');
      (AnalyticsService.fetchTeamAnalytics as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        await result.current.fetchTeamMetrics(mockTeamId, mockFilter);
      });

      expect(result.current.error).toEqual({
        code: 'ANALYTICS_ERROR',
        message: 'API Error'
      });
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Team Comparisons', () => {
    const mockTeamIds = [mockTeamId, 'team-2'];
    const mockComparisonData = [
      { teamId: mockTeamId, metrics: {} },
      { teamId: 'team-2', metrics: {} }
    ];

    beforeEach(() => {
      (AnalyticsService.compareTeams as jest.Mock).mockResolvedValue(mockComparisonData);
    });

    it('should compare teams successfully', async () => {
      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        const comparison = await result.current.compareTeamMetrics(mockTeamIds, mockFilter);
        expect(comparison).toEqual(mockComparisonData);
      });

      expect(AnalyticsService.compareTeams).toHaveBeenCalledWith(mockTeamIds, mockFilter);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should use cached comparison data', async () => {
      const { result } = renderHook(() => useAnalytics());

      // First call to populate cache
      await act(async () => {
        await result.current.compareTeamMetrics(mockTeamIds, mockFilter);
      });

      (AnalyticsService.compareTeams as jest.Mock).mockClear();

      // Second call should use cache
      await act(async () => {
        await result.current.compareTeamMetrics(mockTeamIds, mockFilter);
      });

      expect(AnalyticsService.compareTeams).not.toHaveBeenCalled();
    });

    it('should handle comparison errors', async () => {
      const mockError = new Error('Comparison Failed');
      (AnalyticsService.compareTeams as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        try {
          await result.current.compareTeamMetrics(mockTeamIds, mockFilter);
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(result.current.error).toEqual({
        code: 'COMPARISON_ERROR',
        message: 'Comparison Failed'
      });
    });
  });

  describe('Historical Trends', () => {
    const mockTrendData = [100, 150, 200, 250, 300];

    beforeEach(() => {
      (AnalyticsService.getMetricHistory as jest.Mock).mockResolvedValue(mockTrendData);
    });

    it('should fetch trend data successfully', async () => {
      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        const trend = await result.current.getMetricTrend(
          mockTeamId,
          MetricType.TOTAL_POINTS,
          TimeRange.MONTH
        );

        expect(trend.values).toEqual(mockTrendData);
        expect(trend.labels).toHaveLength(mockTrendData.length);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should generate correct time labels', async () => {
      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        const trend = await result.current.getMetricTrend(
          mockTeamId,
          MetricType.TOTAL_POINTS,
          TimeRange.DAY
        );

        expect(trend.labels).toHaveLength(mockTrendData.length);
        expect(trend.labels[0]).toMatch(/[A-Z][a-z]{2} \d{1,2}/); // Format: "Jan 1"
      });
    });

    it('should handle trend data errors', async () => {
      const mockError = new Error('Trend Error');
      (AnalyticsService.getMetricHistory as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        try {
          await result.current.getMetricTrend(
            mockTeamId,
            MetricType.TOTAL_POINTS,
            TimeRange.MONTH
          );
        } catch (error) {
          expect(error).toBe(mockError);
        }
      });

      expect(result.current.error).toEqual({
        code: 'TREND_ERROR',
        message: 'Trend Error'
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear cache successfully', () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        result.current.clearCache();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'analytics/clearCache'
      });
    });

    it('should detect stale cache', () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        jest.advanceTimersByTime(30 * 1000); // Advance past STALE_WHILE_REVALIDATE
      });

      expect(result.current.isStale).toBe(true);
    });
  });
});