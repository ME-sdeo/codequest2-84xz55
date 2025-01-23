/**
 * @fileoverview Team API client module for CodeQuest platform.
 * Provides secure, monitored, and tenant-aware team management operations.
 * @version 1.0.0
 */

// External imports
import retry from 'axios-retry'; // v3.5.0
import rateLimit from 'axios-rate-limit'; // v1.3.0
import { validateTenant } from '@organization/tenant-validator'; // v1.0.0

// Internal imports
import { apiClient, handleApiError, setTenantHeaders } from '../utils/api.utils';
import { Team, TeamMember, TeamSortField, TeamResponse, TeamStats } from '../types/team.types';
import { ApiResponse, PaginatedResponse } from '../types/common.types';
import { endpoints } from '../config/api.config';

// Configure retry strategy
retry(apiClient, {
  retries: 3,
  retryDelay: retry.exponentialDelay,
  retryCondition: (error) => {
    return retry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});

// Configure rate limiting
const rateLimitedClient = rateLimit(apiClient, {
  maxRequests: 100,
  perMilliseconds: 60000
});

/**
 * Interface for team query parameters
 */
interface TeamQueryParams {
  page?: number;
  limit?: number;
  sortBy?: TeamSortField;
  order?: 'asc' | 'desc';
  tenantId: string;
}

/**
 * Interface for team creation/update payload
 */
interface TeamPayload {
  name: string;
  tenantId: string;
  metadata?: Record<string, any>;
}

/**
 * Team API client with enhanced security and monitoring
 */
export const teamApi = {
  /**
   * Retrieves a paginated list of teams with tenant validation
   */
  async getTeams(params: TeamQueryParams): Promise<ApiResponse<PaginatedResponse<Team>>> {
    try {
      await validateTenant(params.tenantId);
      setTenantHeaders(params.tenantId, params.tenantId.split('-')[0]);

      const response = await rateLimitedClient.get<ApiResponse<PaginatedResponse<Team>>>(
        endpoints.team,
        { params }
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Retrieves a specific team by ID with tenant validation
   */
  async getTeamById(teamId: string, tenantId: string): Promise<ApiResponse<TeamResponse>> {
    try {
      await validateTenant(tenantId);
      setTenantHeaders(tenantId, tenantId.split('-')[0]);

      const response = await rateLimitedClient.get<ApiResponse<TeamResponse>>(
        `${endpoints.team}/${teamId}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Creates a new team with tenant validation
   */
  async createTeam(payload: TeamPayload): Promise<ApiResponse<Team>> {
    try {
      await validateTenant(payload.tenantId);
      setTenantHeaders(payload.tenantId, payload.tenantId.split('-')[0]);

      const response = await rateLimitedClient.post<ApiResponse<Team>>(
        endpoints.team,
        payload
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Updates an existing team with tenant validation
   */
  async updateTeam(teamId: string, payload: TeamPayload): Promise<ApiResponse<Team>> {
    try {
      await validateTenant(payload.tenantId);
      setTenantHeaders(payload.tenantId, payload.tenantId.split('-')[0]);

      const response = await rateLimitedClient.put<ApiResponse<Team>>(
        `${endpoints.team}/${teamId}`,
        payload
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Deletes a team with tenant validation
   */
  async deleteTeam(teamId: string, tenantId: string): Promise<ApiResponse<void>> {
    try {
      await validateTenant(tenantId);
      setTenantHeaders(tenantId, tenantId.split('-')[0]);

      const response = await rateLimitedClient.delete<ApiResponse<void>>(
        `${endpoints.team}/${teamId}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Adds a member to a team with tenant validation
   */
  async addTeamMember(teamId: string, userId: string, tenantId: string): Promise<ApiResponse<TeamMember>> {
    try {
      await validateTenant(tenantId);
      setTenantHeaders(tenantId, tenantId.split('-')[0]);

      const response = await rateLimitedClient.post<ApiResponse<TeamMember>>(
        `${endpoints.team}/${teamId}/members`,
        { userId }
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Removes a member from a team with tenant validation
   */
  async removeTeamMember(teamId: string, userId: string, tenantId: string): Promise<ApiResponse<void>> {
    try {
      await validateTenant(tenantId);
      setTenantHeaders(tenantId, tenantId.split('-')[0]);

      const response = await rateLimitedClient.delete<ApiResponse<void>>(
        `${endpoints.team}/${teamId}/members/${userId}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Retrieves team statistics with tenant validation
   */
  async getTeamStats(teamId: string, tenantId: string): Promise<ApiResponse<TeamStats>> {
    try {
      await validateTenant(tenantId);
      setTenantHeaders(tenantId, tenantId.split('-')[0]);

      const response = await rateLimitedClient.get<ApiResponse<TeamStats>>(
        `${endpoints.team}/${teamId}/stats`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Validates tenant access for team operations
   */
  async validateTenantAccess(tenantId: string): Promise<boolean> {
    try {
      await validateTenant(tenantId);
      return true;
    } catch (error) {
      console.error('Tenant validation failed:', error);
      return false;
    }
  }
};