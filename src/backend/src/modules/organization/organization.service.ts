/**
 * @fileoverview Organization service implementing business logic for organization management
 * with enhanced AI-aware point configuration and audit logging capabilities
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // v10.0.0
import { InjectRepository } from '@nestjs/typeorm'; // v10.0.0
import { Cache } from '@nestjs/cache-manager'; // v2.0.0
import * as winston from 'winston'; // v3.8.0

import { OrganizationEntity } from '../../entities/organization.entity';
import { OrganizationRepository } from '../../repositories/organization.repository';
import { TenantConfig } from '../../interfaces/tenant.interface';
import { ROLES } from '../../constants/roles.constants';

/**
 * Service handling organization management operations with AI-aware point configuration
 */
@Injectable()
export class OrganizationService {
  private readonly logger: winston.Logger;

  constructor(
    @InjectRepository(OrganizationRepository)
    private readonly organizationRepository: OrganizationRepository,
    private readonly cacheManager: Cache
  ) {
    // Initialize winston logger for audit trails
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'organization-service' },
      transports: [
        new winston.transports.File({ filename: 'organization-service.log' })
      ]
    });
  }

  /**
   * Creates a new organization with enhanced validation and logging
   * @param name - Organization name
   * @param companyId - Parent company UUID
   * @param pointOverrides - Optional point configuration overrides
   * @param aiModifiers - AI detection point modifiers
   * @param createdBy - User creating the organization
   * @returns Promise resolving to created organization
   */
  async createOrganization(
    name: string,
    companyId: string,
    pointOverrides?: {
      basePoints: {
        codeCheckIn: number;
        pullRequest: number;
        codeReview: number;
        bugFix: number;
        storyClosure: number;
      };
      aiModifier: number;
    },
    aiModifiers?: Record<string, number>,
    createdBy?: string
  ): Promise<OrganizationEntity> {
    try {
      // Validate organization name
      if (!name || name.length === 0 || name.length > 255) {
        throw new Error('Invalid organization name');
      }

      // Create organization entity
      const organization = new OrganizationEntity(
        name,
        companyId,
        pointOverrides,
        createdBy
      );

      // Save organization
      const savedOrg = await this.organizationRepository.save(organization);

      this.logger.info('Created new organization', {
        id: savedOrg.id,
        companyId,
        name,
        createdBy
      });

      // Invalidate relevant caches
      await this.cacheManager.del(`org_list_${companyId}`);

      return savedOrg;
    } catch (error) {
      this.logger.error('Failed to create organization', {
        name,
        companyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves an organization by ID with caching
   * @param id - Organization UUID
   * @param companyId - Company UUID for tenant isolation
   * @returns Promise resolving to organization if found
   */
  async getOrganization(
    id: string,
    companyId: string
  ): Promise<OrganizationEntity | null> {
    try {
      return await this.organizationRepository.findByIdAndCompanyId(id, companyId);
    } catch (error) {
      this.logger.error('Failed to retrieve organization', {
        id,
        companyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Updates organization point configuration with AI detection support
   * @param id - Organization UUID
   * @param pointOverrides - New point configuration
   * @param aiModifiers - AI detection modifiers
   * @param modifiedBy - User making the modification
   * @returns Promise resolving to updated organization
   */
  async updatePointOverrides(
    id: string,
    pointOverrides: {
      basePoints: {
        codeCheckIn: number;
        pullRequest: number;
        codeReview: number;
        bugFix: number;
        storyClosure: number;
      };
      aiModifier: number;
    },
    modifiedBy: string
  ): Promise<OrganizationEntity> {
    try {
      return await this.organizationRepository.updatePointOverrides(
        id,
        pointOverrides,
        modifiedBy
      );
    } catch (error) {
      this.logger.error('Failed to update point configuration', {
        id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Lists organizations for a company with pagination
   * @param companyId - Company UUID
   * @param options - Pagination options
   * @returns Promise resolving to paginated organization list
   */
  async listOrganizations(
    companyId: string,
    options: { skip?: number; take?: number; } = { skip: 0, take: 10 }
  ): Promise<{ items: OrganizationEntity[]; total: number }> {
    try {
      return await this.organizationRepository.findByCompanyId(companyId, options);
    } catch (error) {
      this.logger.error('Failed to list organizations', {
        companyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculates effective points for an activity with AI detection
   * @param organizationId - Organization UUID
   * @param activityType - Type of activity
   * @param isAIGenerated - Whether activity was AI-generated
   * @returns Promise resolving to calculated points
   */
  async calculateActivityPoints(
    organizationId: string,
    activityType: string,
    isAIGenerated: boolean
  ): Promise<number> {
    try {
      const organization = await this.getOrganization(organizationId, null);
      if (!organization) {
        throw new Error('Organization not found');
      }

      const pointConfig = await organization.getEffectivePointConfig(isAIGenerated);
      return pointConfig[activityType] || 0;
    } catch (error) {
      this.logger.error('Failed to calculate activity points', {
        organizationId,
        activityType,
        isAIGenerated,
        error: error.message
      });
      throw error;
    }
  }
}