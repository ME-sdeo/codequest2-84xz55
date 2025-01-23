/**
 * @fileoverview Organization API client module for CodeQuest frontend application
 * Provides comprehensive CRUD operations for organization management with tenant isolation
 * @version 1.0.0
 */

import { apiClient, handleApiError } from '../utils/api.utils';
import type { ApiResponse, PaginatedResponse } from '../types/common.types';

// Types for organization management
interface Organization extends BaseEntity {
  name: string;
  companyId: string;
  pointOverrides: PointConfig;
  status: OrganizationStatus;
}

interface PointConfig {
  basePoints: Record<ActivityType, number>;
  aiMultiplier: number;
  customRules: Record<string, number>;
}

enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED'
}

enum ActivityType {
  CODE_REVIEW = 'CODE_REVIEW',
  PULL_REQUEST = 'PULL_REQUEST',
  COMMIT = 'COMMIT',
  BUG_FIX = 'BUG_FIX'
}

interface CreateOrganizationDto {
  name: string;
  pointConfig?: Partial<PointConfig>;
}

interface UpdateOrganizationDto {
  name?: string;
  pointConfig?: Partial<PointConfig>;
  status?: OrganizationStatus;
}

interface SortOptions {
  field: keyof Organization;
  direction: 'asc' | 'desc';
}

interface FilterOptions {
  status?: OrganizationStatus;
  search?: string;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const organizationCache = new Map<string, { data: Organization; timestamp: number }>();

/**
 * Retrieves a paginated list of organizations with sorting and filtering
 */
export async function getOrganizations(
  page: number = 1,
  pageSize: number = 20,
  sortBy?: SortOptions,
  filters?: FilterOptions
): Promise<PaginatedResponse<Organization>> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(sortBy && { sort: `${sortBy.field}:${sortBy.direction}` }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.search && { search: filters.search })
    });

    const response = await apiClient.get<PaginatedResponse<Organization>>(`/api/v1/organizations?${params}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Retrieves details of a specific organization with caching
 */
export async function getOrganization(organizationId: string): Promise<ApiResponse<Organization>> {
  try {
    // Check cache
    const cached = organizationCache.get(organizationId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { success: true, data: cached.data };
    }

    const response = await apiClient.get<ApiResponse<Organization>>(`/api/v1/organizations/${organizationId}`);
    
    // Update cache
    organizationCache.set(organizationId, {
      data: response.data.data,
      timestamp: Date.now()
    });

    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Creates a new organization with point configuration
 */
export async function createOrganization(
  organizationData: CreateOrganizationDto
): Promise<ApiResponse<Organization>> {
  try {
    const response = await apiClient.post<ApiResponse<Organization>>(
      '/api/v1/organizations',
      organizationData
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Updates organization details with audit logging
 */
export async function updateOrganization(
  organizationId: string,
  organizationData: UpdateOrganizationDto
): Promise<ApiResponse<Organization>> {
  try {
    const response = await apiClient.put<ApiResponse<Organization>>(
      `/api/v1/organizations/${organizationId}`,
      organizationData
    );

    // Invalidate cache
    organizationCache.delete(organizationId);

    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Deletes an organization with cascading cleanup
 */
export async function deleteOrganization(organizationId: string): Promise<ApiResponse<void>> {
  try {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/organizations/${organizationId}`);
    
    // Clear cache
    organizationCache.delete(organizationId);

    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Retrieves point configuration for an organization
 */
export async function getOrganizationPoints(organizationId: string): Promise<ApiResponse<PointConfig>> {
  try {
    const response = await apiClient.get<ApiResponse<PointConfig>>(
      `/api/v1/organizations/${organizationId}/points`
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}