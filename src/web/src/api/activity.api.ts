/**
 * @fileoverview API client module for handling Azure DevOps activity-related HTTP requests
 * Implements secure, monitored, and real-time activity tracking with AI detection support
 * @version 1.0.0
 */

// External imports
import axios from 'axios'; // v1.4.0

// Internal imports
import { Activity, ActivityType, ActivityMetadata } from '../types/activity.types';
import { ApiResponse } from '../types/common.types';
import { apiClient, handleApiError } from '../utils/api.utils';

// Constants for API endpoints and configuration
const API_ENDPOINTS = {
  ACTIVITIES: '/api/v1/activities',
  TEAM_ACTIVITIES: '/api/v1/teams/{teamId}/activities',
  USER_ACTIVITIES: '/api/v1/users/{userId}/activities'
} as const;

const REQUEST_CONFIG = {
  TIMEOUT: 5000,
  RETRY_ATTEMPTS: 3,
  CIRCUIT_BREAKER_THRESHOLD: 5
} as const;

/**
 * Interface for activity query parameters
 */
interface ActivityQueryParams {
  page: number;
  limit: number;
  teamId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  includeAiGenerated?: boolean;
}

/**
 * Interface for activity creation payload
 */
interface CreateActivityPayload {
  type: ActivityType;
  teamMemberId: string;
  metadata: ActivityMetadata;
  isAiGenerated?: boolean;
}

/**
 * Formats date parameters for API requests
 */
const formatDateParam = (date: Date): string => {
  return date.toISOString();
};

/**
 * Builds query string from activity query parameters
 */
const buildQueryString = (params: ActivityQueryParams): string => {
  const queryParams = new URLSearchParams();
  
  queryParams.append('page', params.page.toString());
  queryParams.append('limit', params.limit.toString());
  
  if (params.teamId) queryParams.append('teamId', params.teamId);
  if (params.userId) queryParams.append('userId', params.userId);
  if (params.startDate) queryParams.append('startDate', formatDateParam(params.startDate));
  if (params.endDate) queryParams.append('endDate', formatDateParam(params.endDate));
  if (params.includeAiGenerated !== undefined) {
    queryParams.append('includeAiGenerated', params.includeAiGenerated.toString());
  }
  
  return queryParams.toString();
};

/**
 * Activity API client implementation with enhanced security and monitoring
 */
export const activityApi = {
  /**
   * Retrieves a paginated list of activities with filtering options
   * @param params Query parameters for filtering and pagination
   * @returns Promise resolving to paginated activity list
   */
  getActivities: async (params: ActivityQueryParams): Promise<ApiResponse<Activity[]>> => {
    try {
      // Validate required parameters
      if (params.page < 1 || params.limit < 1) {
        throw new Error('Invalid pagination parameters');
      }

      // Build request URL with query parameters
      const queryString = buildQueryString(params);
      const url = `${API_ENDPOINTS.ACTIVITIES}?${queryString}`;

      // Make request with monitoring and circuit breaker
      const response = await apiClient.get<ApiResponse<Activity[]>>(url, {
        timeout: REQUEST_CONFIG.TIMEOUT,
        headers: {
          'Cache-Control': 'no-cache',
          'X-Request-Type': 'activity-list'
        }
      });

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Creates a new activity with AI detection support
   * @param data Activity creation payload
   * @returns Promise resolving to created activity
   */
  createActivity: async (data: CreateActivityPayload): Promise<ApiResponse<Activity>> => {
    try {
      // Validate required fields
      if (!data.teamMemberId || !data.type || !data.metadata) {
        throw new Error('Missing required activity data');
      }

      // Validate metadata fields
      if (!data.metadata.adoId || !data.metadata.repository || !data.metadata.url) {
        throw new Error('Invalid activity metadata');
      }

      // Make request with security headers and monitoring
      const response = await apiClient.post<ApiResponse<Activity>>(
        API_ENDPOINTS.ACTIVITIES,
        data,
        {
          timeout: REQUEST_CONFIG.TIMEOUT,
          headers: {
            'X-Request-Type': 'activity-create',
            'X-Activity-Type': data.type
          }
        }
      );

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Retrieves activities for a specific team
   * @param teamId Team identifier
   * @param params Query parameters for filtering and pagination
   * @returns Promise resolving to team's activity list
   */
  getTeamActivities: async (
    teamId: string,
    params: Omit<ActivityQueryParams, 'teamId'>
  ): Promise<ApiResponse<Activity[]>> => {
    try {
      const queryString = buildQueryString({ ...params, teamId });
      const url = API_ENDPOINTS.TEAM_ACTIVITIES.replace('{teamId}', teamId);
      
      const response = await apiClient.get<ApiResponse<Activity[]>>(
        `${url}?${queryString}`,
        {
          timeout: REQUEST_CONFIG.TIMEOUT,
          headers: {
            'X-Request-Type': 'team-activities',
            'X-Team-ID': teamId
          }
        }
      );

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Retrieves activities for a specific user
   * @param userId User identifier
   * @param params Query parameters for filtering and pagination
   * @returns Promise resolving to user's activity list
   */
  getUserActivities: async (
    userId: string,
    params: Omit<ActivityQueryParams, 'userId'>
  ): Promise<ApiResponse<Activity[]>> => {
    try {
      const queryString = buildQueryString({ ...params, userId });
      const url = API_ENDPOINTS.USER_ACTIVITIES.replace('{userId}', userId);
      
      const response = await apiClient.get<ApiResponse<Activity[]>>(
        `${url}?${queryString}`,
        {
          timeout: REQUEST_CONFIG.TIMEOUT,
          headers: {
            'X-Request-Type': 'user-activities',
            'X-User-ID': userId
          }
        }
      );

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }
};