/**
 * @fileoverview Points API client module for CodeQuest frontend application
 * Handles points-related operations with enhanced error handling, caching, and real-time updates
 * @version 1.0.0
 */

// External imports
import type { AxiosResponse } from 'axios'; // v1.4.0
import retry from 'axios-retry'; // v3.5.0
import { handleError } from '@error-handling/utils'; // v2.1.0
import { cacheManager } from '@caching/utils'; // v1.2.0

// Internal imports
import { apiClient } from '../utils/api.utils';
import { endpoints } from '../config/api.config';
import type { ApiResponse, PaginatedResponse } from '../types/common.types';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const LEADERBOARD_CACHE_TTL = 60; // 1 minute

// Types for points-related data
interface PointsConfig {
  basePoints: Record<string, number>;
  aiModifier: number;
  organizationOverrides?: Record<string, number>;
}

interface PointsHistory {
  id: string;
  teamMemberId: string;
  activityType: string;
  points: number;
  isAiGenerated: boolean;
  timestamp: Date;
}

interface LevelProgress {
  currentLevel: number;
  totalPoints: number;
  pointsToNextLevel: number;
  progressPercentage: number;
}

interface LeaderboardEntry {
  teamMemberId: string;
  displayName: string;
  totalPoints: number;
  currentLevel: number;
  rank: number;
}

interface PointsApiOptions {
  timeout?: number;
  enableCache?: boolean;
  correlationId?: string;
}

/**
 * Retrieves points configuration for the current organization
 * @param organizationId - Organization identifier
 * @param options - API request options
 * @returns Promise resolving to points configuration
 */
const getPointsConfig = async (
  organizationId: string,
  options: PointsApiOptions = {}
): Promise<ApiResponse<PointsConfig>> => {
  const cacheKey = `points-config-${organizationId}`;

  try {
    // Check cache first if enabled
    if (options.enableCache !== false) {
      const cached = await cacheManager.get<PointsConfig>(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    const response = await apiClient.get<ApiResponse<PointsConfig>>(
      `${endpoints.points}/config/${organizationId}`,
      {
        timeout: options.timeout,
        headers: {
          'X-Correlation-ID': options.correlationId || crypto.randomUUID()
        }
      }
    );

    // Cache successful response
    if (response.data.success) {
      await cacheManager.set(cacheKey, response.data.data, CACHE_TTL);
    }

    return response.data;
  } catch (error) {
    return handleError('Failed to fetch points configuration', error);
  }
};

/**
 * Retrieves points history for a team member with pagination and filtering
 * @param teamMemberId - Team member identifier
 * @param filters - Optional filters for history
 * @param options - API request options
 * @returns Promise resolving to paginated points history
 */
const getPointsHistory = async (
  teamMemberId: string,
  filters: {
    startDate?: Date;
    endDate?: Date;
    activityType?: string;
    page?: number;
    pageSize?: number;
  } = {},
  options: PointsApiOptions = {}
): Promise<ApiResponse<PaginatedResponse<PointsHistory>>> => {
  try {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<PointsHistory>>>(
      `${endpoints.points}/history/${teamMemberId}`,
      {
        params: {
          ...filters,
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString()
        },
        timeout: options.timeout,
        headers: {
          'X-Correlation-ID': options.correlationId || crypto.randomUUID()
        }
      }
    );

    return response.data;
  } catch (error) {
    return handleError('Failed to fetch points history', error);
  }
};

/**
 * Retrieves current level progress with real-time updates
 * @param teamMemberId - Team member identifier
 * @param options - API request options
 * @returns Promise resolving to level progress information
 */
const getLevelProgress = async (
  teamMemberId: string,
  options: PointsApiOptions = {}
): Promise<ApiResponse<LevelProgress>> => {
  const cacheKey = `level-progress-${teamMemberId}`;

  try {
    // Check cache first if enabled
    if (options.enableCache !== false) {
      const cached = await cacheManager.get<LevelProgress>(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    const response = await apiClient.get<ApiResponse<LevelProgress>>(
      `${endpoints.points}/progress/${teamMemberId}`,
      {
        timeout: options.timeout,
        headers: {
          'X-Correlation-ID': options.correlationId || crypto.randomUUID()
        }
      }
    );

    // Cache successful response
    if (response.data.success) {
      await cacheManager.set(cacheKey, response.data.data, CACHE_TTL);
    }

    return response.data;
  } catch (error) {
    return handleError('Failed to fetch level progress', error);
  }
};

/**
 * Retrieves leaderboard data with real-time updates and caching
 * @param teamId - Team identifier
 * @param options - API request options
 * @returns Promise resolving to leaderboard entries
 */
const getLeaderboard = async (
  teamId: string,
  options: PointsApiOptions = {}
): Promise<ApiResponse<LeaderboardEntry[]>> => {
  const cacheKey = `leaderboard-${teamId}`;

  try {
    // Check cache first if enabled
    if (options.enableCache !== false) {
      const cached = await cacheManager.get<LeaderboardEntry[]>(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    const response = await apiClient.get<ApiResponse<LeaderboardEntry[]>>(
      `${endpoints.points}/leaderboard/${teamId}`,
      {
        timeout: options.timeout,
        headers: {
          'X-Correlation-ID': options.correlationId || crypto.randomUUID()
        }
      }
    );

    // Cache successful response with shorter TTL for real-time updates
    if (response.data.success) {
      await cacheManager.set(cacheKey, response.data.data, LEADERBOARD_CACHE_TTL);
    }

    return response.data;
  } catch (error) {
    return handleError('Failed to fetch leaderboard', error);
  }
};

// Configure retry mechanism for the points API
retry(apiClient, {
  retries: 3,
  retryDelay: retry.exponentialDelay,
  retryCondition: (error) => {
    return retry.isNetworkOrIdempotentRequestError(error) ||
           (error.response?.status === 429); // Retry on rate limit
  }
});

// Export the points API interface
export const pointsApi = {
  getPointsConfig,
  getPointsHistory,
  getLevelProgress,
  getLeaderboard
};

// Export types for consumers
export type {
  PointsConfig,
  PointsHistory,
  LevelProgress,
  LeaderboardEntry,
  PointsApiOptions
};