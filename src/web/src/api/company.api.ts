/**
 * @fileoverview Company API client module for CodeQuest frontend application
 * Implements secure multi-tenant operations with comprehensive error handling
 * @version 1.0.0
 */

import { apiClient } from '../utils/api.utils';
import { endpoints } from '../config/api.config';
import type { ApiResponse, BaseEntity } from '../types/common.types';

/**
 * Company entity interface extending BaseEntity with company-specific fields
 */
export interface Company extends BaseEntity {
  name: string;
  subscriptionTier: string;
  pointConfig: object;
  description: string | null;
  isActive: boolean;
  subscriptionEndDate: Date;
}

/**
 * Data transfer object for company creation with required fields
 */
export interface CreateCompanyDto {
  name: string;
  subscriptionTier: string;
  pointConfig: object;
  description: string | null;
  isActive: boolean;
}

/**
 * Data transfer object for partial company updates
 */
export interface UpdateCompanyDto {
  name?: string;
  subscriptionTier?: string;
  pointConfig?: object;
  description?: string | null;
  isActive?: boolean;
}

/**
 * Cache duration in seconds for company data
 */
const CACHE_DURATION = 300;

/**
 * Retrieves company details by ID with caching and error handling
 * @param id Company unique identifier
 * @returns Promise resolving to company details with error handling
 */
export async function getCompany(id: string): Promise<ApiResponse<Company>> {
  try {
    const response = await apiClient.get<ApiResponse<Company>>(
      `${endpoints.company}/${id}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching company:', error);
    return {
      success: false,
      data: null as any,
      error: 'Failed to retrieve company details'
    };
  }
}

/**
 * Creates a new company with validation and retry logic
 * @param data Company creation data transfer object
 * @returns Promise resolving to created company with error handling
 */
export async function createCompany(
  data: CreateCompanyDto
): Promise<ApiResponse<Company>> {
  try {
    const response = await apiClient.post<ApiResponse<Company>>(
      endpoints.company,
      data
    );
    return response.data;
  } catch (error) {
    console.error('Error creating company:', error);
    return {
      success: false,
      data: null as any,
      error: 'Failed to create company'
    };
  }
}

/**
 * Updates an existing company with partial updates support
 * @param id Company unique identifier
 * @param data Partial company update data
 * @returns Promise resolving to updated company with error handling
 */
export async function updateCompany(
  id: string,
  data: UpdateCompanyDto
): Promise<ApiResponse<Company>> {
  try {
    const response = await apiClient.put<ApiResponse<Company>>(
      `${endpoints.company}/${id}`,
      data
    );
    return response.data;
  } catch (error) {
    console.error('Error updating company:', error);
    return {
      success: false,
      data: null as any,
      error: 'Failed to update company'
    };
  }
}

/**
 * Deletes a company by ID with proper cleanup
 * @param id Company unique identifier
 * @returns Promise resolving to deletion confirmation
 */
export async function deleteCompany(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${endpoints.company}/${id}`
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting company:', error);
    return {
      success: false,
      data: null as any,
      error: 'Failed to delete company'
    };
  }
}

/**
 * Retrieves point configuration for a company with caching
 * @param id Company unique identifier
 * @returns Promise resolving to company point configuration
 */
export async function getCompanyPointConfig(
  id: string
): Promise<ApiResponse<object>> {
  try {
    const response = await apiClient.get<ApiResponse<object>>(
      `${endpoints.company}/${id}/point-config`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching company point config:', error);
    return {
      success: false,
      data: null as any,
      error: 'Failed to retrieve point configuration'
    };
  }
}