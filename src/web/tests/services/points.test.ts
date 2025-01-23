/**
 * @fileoverview Comprehensive test suite for the points service
 * Tests point calculations, history tracking, level progression, and leaderboard functionality
 * with real-time updates and AI detection modifiers
 * @version 1.0.0
 */

import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { pointsService } from '../../src/services/points.service';
import { pointsApi } from '../../src/api/points.api';
import { ActivityType } from '../../src/types/activity.types';
import { DEFAULT_POINTS_CONFIG, LEVEL_THRESHOLDS } from '../../src/constants/points.constants';

// Mock the points API
vi.mock('../../src/api/points.api');

// Test data constants
const TEST_ORG_ID = 'test-org-123';
const TEST_USER_ID = 'test-user-123';
const TEST_TEAM_ID = 'test-team-123';

const mockPointsConfig = {
  basePoints: DEFAULT_POINTS_CONFIG.basePoints,
  aiModifier: 0.75,
  organizationOverrides: {
    [ActivityType.CODE_REVIEW]: 20 // Override for testing
  }
};

const mockPointsHistory = {
  data: [
    {
      id: '1',
      teamMemberId: TEST_USER_ID,
      activityType: ActivityType.CODE_CHECKIN,
      points: 10,
      isAiGenerated: false,
      timestamp: new Date()
    }
  ],
  total: 1,
  page: 1,
  pageSize: 20
};

const mockLevelProgress = {
  currentLevel: 2,
  totalPoints: 750,
  nextLevelThreshold: 1000,
  previousLevelThreshold: 500,
  pointsToNextLevel: 250,
  progressPercentage: 50
};

const mockLeaderboard = [
  {
    teamMemberId: TEST_USER_ID,
    displayName: 'Test User',
    totalPoints: 750,
    level: 2,
    rank: 1,
    lastActivityTimestamp: new Date(),
    recentActivities: [ActivityType.CODE_CHECKIN]
  }
];

describe('Points Service', () => {
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock API responses
    vi.mocked(pointsApi.getPointsConfig).mockResolvedValue({
      success: true,
      data: mockPointsConfig
    });

    vi.mocked(pointsApi.getPointsHistory).mockResolvedValue({
      success: true,
      data: mockPointsHistory
    });

    vi.mocked(pointsApi.getLevelProgress).mockResolvedValue({
      success: true,
      data: mockLevelProgress
    });

    vi.mocked(pointsApi.getLeaderboard).mockResolvedValue({
      success: true,
      data: mockLeaderboard
    });

    // Initialize service
    await pointsService.initializePointsService(TEST_ORG_ID);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Points Configuration', () => {
    it('should retrieve and cache points configuration', async () => {
      const config = await pointsService.getPointsConfiguration();
      expect(config).toEqual(mockPointsConfig);
      expect(pointsApi.getPointsConfig).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await pointsService.getPointsConfiguration();
      expect(pointsApi.getPointsConfig).toHaveBeenCalledTimes(1);
    });

    it('should apply organization-specific overrides', async () => {
      const config = await pointsService.getPointsConfiguration();
      expect(config.basePoints[ActivityType.CODE_REVIEW]).toBe(20);
    });

    it('should handle configuration retrieval errors', async () => {
      vi.mocked(pointsApi.getPointsConfig).mockRejectedValueOnce(new Error('API Error'));
      const config = await pointsService.getPointsConfiguration();
      expect(config).toEqual(DEFAULT_POINTS_CONFIG);
    });
  });

  describe('Points Calculation', () => {
    it('should calculate regular activity points correctly', async () => {
      const points = await pointsService.calculateUserPoints(
        TEST_USER_ID,
        ActivityType.CODE_CHECKIN,
        false
      );
      expect(points).toBe(10);
    });

    it('should apply AI modifier for AI-generated code', async () => {
      const points = await pointsService.calculateUserPoints(
        TEST_USER_ID,
        ActivityType.CODE_CHECKIN,
        true
      );
      expect(points).toBe(7.5); // 10 * 0.75
    });

    it('should use organization overrides when available', async () => {
      const points = await pointsService.calculateUserPoints(
        TEST_USER_ID,
        ActivityType.CODE_REVIEW,
        false
      );
      expect(points).toBe(20); // Override value
    });

    it('should handle calculation errors gracefully', async () => {
      vi.mocked(pointsApi.getPointsConfig).mockRejectedValueOnce(new Error('API Error'));
      const points = await pointsService.calculateUserPoints(
        TEST_USER_ID,
        ActivityType.CODE_CHECKIN,
        false
      );
      expect(points).toBe(10); // Default value
    });
  });

  describe('Points History', () => {
    it('should retrieve paginated points history', async () => {
      const history = await pointsService.getUserPointsHistory(TEST_USER_ID);
      expect(history).toEqual(mockPointsHistory.data);
      expect(pointsApi.getPointsHistory).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.any(Object)
      );
    });

    it('should handle history retrieval errors', async () => {
      vi.mocked(pointsApi.getPointsHistory).mockRejectedValueOnce(new Error('API Error'));
      const history = await pointsService.getUserPointsHistory(TEST_USER_ID);
      expect(history).toEqual([]);
    });
  });

  describe('Level Progression', () => {
    it('should retrieve current level progress', async () => {
      const progress = await pointsService.getUserLevelProgress(TEST_USER_ID);
      expect(progress).toEqual(mockLevelProgress);
    });

    it('should calculate progress percentage correctly', async () => {
      const progress = await pointsService.getUserLevelProgress(TEST_USER_ID);
      expect(progress.progressPercentage).toBe(50);
    });

    it('should handle level progress errors', async () => {
      vi.mocked(pointsApi.getLevelProgress).mockRejectedValueOnce(new Error('API Error'));
      await expect(pointsService.getUserLevelProgress(TEST_USER_ID)).rejects.toThrow();
    });
  });

  describe('Leaderboard', () => {
    it('should retrieve team leaderboard', async () => {
      const leaderboard = await pointsService.getTeamLeaderboard(TEST_TEAM_ID);
      expect(leaderboard).toEqual(mockLeaderboard);
    });

    it('should handle real-time updates', async () => {
      vi.useFakeTimers();
      const leaderboard = await pointsService.getTeamLeaderboard(TEST_TEAM_ID);
      
      // Simulate real-time update
      vi.advanceTimersByTime(1000);
      const updatedLeaderboard = await pointsService.getTeamLeaderboard(TEST_TEAM_ID);
      
      expect(updatedLeaderboard).toEqual(mockLeaderboard);
      expect(pointsApi.getLeaderboard).toHaveBeenCalledTimes(2);
    });

    it('should handle leaderboard retrieval errors', async () => {
      vi.mocked(pointsApi.getLeaderboard).mockRejectedValueOnce(new Error('API Error'));
      const leaderboard = await pointsService.getTeamLeaderboard(TEST_TEAM_ID);
      expect(leaderboard).toEqual([]);
    });
  });
});