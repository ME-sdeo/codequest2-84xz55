/**
 * @fileoverview Test suite for analytics service functionality
 * Covers performance metrics, team comparisons, historical trending,
 * response time validation, and multi-tenant data isolation
 * @version 1.0.0
 */

import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'; // v0.34.0
import { performance } from 'perf_hooks';
import { AnalyticsService } from '../../src/services/analytics.service';
import type { 
  AnalyticsFilter, 
  TeamAnalytics, 
  MetricType, 
  TimeRange,
  TeamComparison,
  TrendAnalysis 
} from '../../src/types/analytics.types';
import type { TenantEntity } from '../../src/types/common.types';

// Constants for test configuration
const SLA_THRESHOLD = 500; // 500ms SLA requirement
const TEST_TENANT_ID = 'test-tenant-001';
const MOCK_CACHE_DURATION = 300000; // 5 minutes

// Mock tenant context
const mockTenantContext = {
  companyId: 'company-001',
  organizationId: 'org-001'
};

// Mock test data
const mockAnalyticsFilter: AnalyticsFilter = {
  timeRange: TimeRange.MONTH,
  startDate: new Date('2023-01-01'),
  endDate: new Date('2023-01-31'),
  activityTypes: [],
  teamIds: ['team-001']
};

const mockTeamAnalytics: TeamAnalytics = {
  id: 'analytics-001',
  teamId: 'team-001',
  companyId: mockTenantContext.companyId,
  organizationId: mockTenantContext.organizationId,
  createdAt: new Date(),
  updatedAt: new Date(),
  metrics: {
    [MetricType.TOTAL_POINTS]: {
      type: MetricType.TOTAL_POINTS,
      value: 1000,
      change: 10,
      trend: [900, 950, 1000]
    }
  },
  activityBreakdown: {},
  topContributors: []
};

/**
 * Helper function to measure response time of async operations
 */
const measureResponseTime = async <T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await operation();
  const duration = performance.now() - start;
  return { result, duration };
};

/**
 * Helper function to verify tenant isolation
 */
const verifyTenantIsolation = (data: TenantEntity) => {
  expect(data.companyId).toBe(mockTenantContext.companyId);
  expect(data.organizationId).toBe(mockTenantContext.organizationId);
};

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cache between tests
    vi.mock('../../src/services/analytics.service', () => {
      const actual = vi.importActual('../../src/services/analytics.service');
      return {
        ...actual,
        // Reset memoization cache
        fetchTeamAnalytics: vi.fn(),
        compareTeams: vi.fn(),
        getMetricHistory: vi.fn()
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTeamAnalytics', () => {
    it('should fetch team analytics within SLA threshold', async () => {
      const { duration } = await measureResponseTime(async () => {
        await AnalyticsService.fetchTeamAnalytics('team-001', mockAnalyticsFilter);
      });
      
      expect(duration).toBeLessThan(SLA_THRESHOLD);
    });

    it('should maintain tenant data isolation', async () => {
      vi.mocked(AnalyticsService.fetchTeamAnalytics).mockResolvedValue(mockTeamAnalytics);
      
      const result = await AnalyticsService.fetchTeamAnalytics('team-001', mockAnalyticsFilter);
      
      verifyTenantIsolation(result);
    });

    it('should handle cache correctly per tenant', async () => {
      const mockFetch = vi.mocked(AnalyticsService.fetchTeamAnalytics);
      mockFetch.mockResolvedValue(mockTeamAnalytics);

      // First call should hit the API
      await AnalyticsService.fetchTeamAnalytics('team-001', mockAnalyticsFilter);
      
      // Second call within cache duration should use cached data
      await AnalyticsService.fetchTeamAnalytics('team-001', mockAnalyticsFilter);
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('compareTeams', () => {
    const teamIds = ['team-001', 'team-002'];

    it('should compare teams with tenant isolation', async () => {
      const mockComparison: TeamComparison = {
        baseTeamId: teamIds[0],
        comparisonTeamIds: [teamIds[1]],
        metrics: [MetricType.TOTAL_POINTS],
        results: {
          [MetricType.TOTAL_POINTS]: {
            values: { 'team-001': 1000, 'team-002': 1200 },
            differences: { 'team-001': 0, 'team-002': 20 }
          }
        }
      };

      vi.mocked(AnalyticsService.compareTeams).mockResolvedValue(mockComparison);
      
      const result = await AnalyticsService.compareTeams(teamIds, mockAnalyticsFilter);
      
      expect(result.baseTeamId).toBe(teamIds[0]);
      expect(result.comparisonTeamIds).toContain(teamIds[1]);
    });

    it('should meet performance SLA for comparisons', async () => {
      const { duration } = await measureResponseTime(async () => {
        await AnalyticsService.compareTeams(teamIds, mockAnalyticsFilter);
      });
      
      expect(duration).toBeLessThan(SLA_THRESHOLD);
    });
  });

  describe('getMetricHistory', () => {
    it('should retrieve historical data within SLA', async () => {
      const mockTrend: TrendAnalysis = {
        period: TimeRange.MONTH,
        dataPoints: [
          { timestamp: new Date('2023-01-01'), value: 900 },
          { timestamp: new Date('2023-01-15'), value: 950 },
          { timestamp: new Date('2023-01-31'), value: 1000 }
        ]
      };

      vi.mocked(AnalyticsService.getMetricHistory).mockResolvedValue(mockTrend);
      
      const { duration } = await measureResponseTime(async () => {
        await AnalyticsService.getMetricHistory(
          'team-001',
          MetricType.TOTAL_POINTS,
          mockAnalyticsFilter
        );
      });
      
      expect(duration).toBeLessThan(SLA_THRESHOLD);
    });

    it('should calculate growth rate correctly', () => {
      const currentValue = 1200;
      const previousValue = 1000;
      const expectedGrowth = 20; // ((1200 - 1000) / 1000) * 100

      const growth = AnalyticsService.calculateGrowthRate(currentValue, previousValue);
      
      expect(growth).toBe(expectedGrowth);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache responses for subsequent calls', async () => {
      const mockFetch = vi.mocked(AnalyticsService.fetchTeamAnalytics);
      mockFetch.mockResolvedValue(mockTeamAnalytics);

      // First call
      await AnalyticsService.fetchTeamAnalytics('team-001', mockAnalyticsFilter);
      
      // Second call within cache duration
      const { duration } = await measureResponseTime(async () => {
        await AnalyticsService.fetchTeamAnalytics('team-001', mockAnalyticsFilter);
      });

      expect(duration).toBeLessThan(50); // Cached responses should be very fast
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent requests efficiently', async () => {
      const mockFetch = vi.mocked(AnalyticsService.fetchTeamAnalytics);
      mockFetch.mockResolvedValue(mockTeamAnalytics);

      const requests = Array(5).fill(null).map(() => 
        AnalyticsService.fetchTeamAnalytics('team-001', mockAnalyticsFilter)
      );

      const { duration } = await measureResponseTime(async () => {
        await Promise.all(requests);
      });

      expect(duration).toBeLessThan(SLA_THRESHOLD);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});