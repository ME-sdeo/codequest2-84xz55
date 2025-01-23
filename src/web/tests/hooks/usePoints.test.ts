/**
 * @fileoverview Comprehensive test suite for usePoints custom React hook
 * Tests points calculation, history tracking, level progression, and real-time updates
 * @version 1.0.0
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { usePoints } from '../../src/hooks/usePoints';
import { pointsService } from '../../src/services/points.service';
import { ActivityType } from '../../src/types/activity.types';

// Mock the points service
jest.mock('../../src/services/points.service');

// Mock Redux hooks
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  useDispatch: jest.fn()
}));

// Performance monitoring mock
const mockPerformanceMonitor = {
  start: jest.fn(),
  end: jest.fn(),
  getMetrics: jest.fn()
};

describe('usePoints', () => {
  const mockTeamMemberId = 'test-user-123';
  const mockDispatch = jest.fn();
  const mockStore = {
    points: {
      history: [],
      levelProgress: null,
      leaderboard: []
    }
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockPerformanceMonitor.start.mockClear();
    mockPerformanceMonitor.end.mockClear();

    // Setup mock implementations
    (pointsService.calculateUserPoints as jest.Mock).mockResolvedValue(25);
    (pointsService.getUserPointsHistory as jest.Mock).mockResolvedValue([]);
    (pointsService.getUserLevelProgress as jest.Mock).mockResolvedValue({
      currentLevel: 1,
      totalPoints: 0,
      nextLevelThreshold: 500,
      previousLevelThreshold: 0,
      pointsToNextLevel: 500,
      progressPercentage: 0
    });
    (pointsService.connectWebSocket as jest.Mock).mockReturnValue({
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('calculateActivityPoints handles regular and AI-detected activities correctly', async () => {
    const { result } = renderHook(() => usePoints(mockTeamMemberId, { enableRealTime: true }));

    // Test regular point calculation
    await act(async () => {
      const regularPoints = await result.current.calculateActivityPoints(
        ActivityType.PULL_REQUEST,
        false
      );
      expect(regularPoints).toBe(25);
      expect(pointsService.calculateUserPoints).toHaveBeenCalledWith(
        mockTeamMemberId,
        ActivityType.PULL_REQUEST,
        false
      );
    });

    // Test AI-detected point calculation
    await act(async () => {
      (pointsService.calculateUserPoints as jest.Mock).mockResolvedValue(18.75);
      const aiPoints = await result.current.calculateActivityPoints(
        ActivityType.PULL_REQUEST,
        true
      );
      expect(aiPoints).toBe(18.75);
      expect(pointsService.calculateUserPoints).toHaveBeenCalledWith(
        mockTeamMemberId,
        ActivityType.PULL_REQUEST,
        true
      );
    });
  });

  test('getPointsHistory retrieves and caches history correctly', async () => {
    const mockHistory = [
      {
        id: '1',
        teamMemberId: mockTeamMemberId,
        points: 25,
        activityType: ActivityType.PULL_REQUEST,
        timestamp: new Date()
      }
    ];

    (pointsService.getUserPointsHistory as jest.Mock).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => usePoints(mockTeamMemberId));

    await act(async () => {
      const history = await result.current.getPointsHistory();
      expect(history).toEqual(mockHistory);
      expect(pointsService.getUserPointsHistory).toHaveBeenCalledWith(mockTeamMemberId);
    });
  });

  test('real-time updates work correctly with WebSocket integration', async () => {
    jest.useFakeTimers();

    const mockWebSocket = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    };

    (pointsService.subscribeToPointsUpdates as jest.Mock).mockReturnValue(mockWebSocket);

    const { result } = renderHook(() => usePoints(mockTeamMemberId, { enableRealTime: true }));

    // Verify WebSocket connection
    expect(pointsService.subscribeToPointsUpdates).toHaveBeenCalledWith(mockTeamMemberId);

    // Simulate point update
    const mockUpdate = {
      points: 25,
      activityType: ActivityType.PULL_REQUEST
    };

    await act(async () => {
      mockWebSocket.subscribe.mock.calls[0][0].next(mockUpdate);
    });

    // Verify WebSocket status
    expect(result.current.wsStatus.connected).toBe(true);
    expect(result.current.wsStatus.lastUpdate).toBeInstanceOf(Date);
  });

  test('error handling and retry logic works correctly', async () => {
    const mockError = new Error('API Error');
    (pointsService.calculateUserPoints as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => usePoints(mockTeamMemberId));

    await act(async () => {
      try {
        await result.current.calculateActivityPoints(ActivityType.PULL_REQUEST, false);
      } catch (error) {
        expect(error).toBe(mockError);
        expect(result.current.error.points).toBe(mockError.message);
      }
    });
  });

  test('level progression tracking works correctly', async () => {
    const mockLevelProgress = {
      currentLevel: 2,
      totalPoints: 750,
      nextLevelThreshold: 1000,
      previousLevelThreshold: 500,
      pointsToNextLevel: 250,
      progressPercentage: 50
    };

    (pointsService.getUserLevelProgress as jest.Mock).mockResolvedValue(mockLevelProgress);

    const { result } = renderHook(() => usePoints(mockTeamMemberId));

    await act(async () => {
      const progress = await result.current.getLevelProgress();
      expect(progress).toEqual(mockLevelProgress);
      expect(pointsService.getUserLevelProgress).toHaveBeenCalledWith(mockTeamMemberId);
    });
  });

  test('performance requirements are met', async () => {
    const { result } = renderHook(() => usePoints(mockTeamMemberId, { enableRealTime: true }));

    mockPerformanceMonitor.start();
    
    await act(async () => {
      await result.current.calculateActivityPoints(ActivityType.PULL_REQUEST, false);
    });

    mockPerformanceMonitor.end();

    const metrics = mockPerformanceMonitor.getMetrics();
    expect(metrics?.duration).toBeLessThan(500); // 500ms SLA requirement
  });
});