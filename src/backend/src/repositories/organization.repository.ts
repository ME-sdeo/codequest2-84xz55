/**
 * @fileoverview Organization repository implementation for CodeQuest's multi-tenant architecture
 * Implements enhanced organization management with AI detection and audit support
 * @version 1.0.0
 */

import { 
  EntityRepository, 
  Repository, 
  FindOptionsWhere, 
  QueryFailedError 
} from 'typeorm'; // v0.3.0
import * as winston from 'winston'; // v3.8.0
import { OrganizationEntity } from '../entities/organization.entity';
import { TenantConfig } from '../interfaces/tenant.interface';

/**
 * Enhanced repository class for managing organization entities with AI detection and audit support
 */
@EntityRepository(OrganizationEntity)
export class OrganizationRepository extends Repository<OrganizationEntity> {
  private readonly logger: winston.Logger;

  constructor() {
    super();
    // Initialize winston logger for audit trails
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'organization-repository' },
      transports: [
        new winston.transports.File({ filename: 'organization-audit.log' })
      ]
    });
  }

  /**
   * Finds all organizations belonging to a company with pagination
   * @param companyId - UUID of the company
   * @param options - Pagination options
   * @returns Promise resolving to paginated organization list
   */
  async findByCompanyId(
    companyId: string,
    options: { skip?: number; take?: number; } = { skip: 0, take: 10 }
  ): Promise<{ items: OrganizationEntity[]; total: number }> {
    try {
      const [items, total] = await this.findAndCount({
        where: { companyId },
        skip: options.skip,
        take: options.take,
        order: { name: 'ASC' },
        cache: {
          id: `org_list_${companyId}`,
          milliseconds: 30000 // 30 second cache
        }
      });

      this.logger.info('Retrieved organization list', {
        companyId,
        count: items.length,
        total
      });

      return { items, total };
    } catch (error) {
      this.logger.error('Failed to retrieve organizations', {
        companyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Finds a specific organization by ID within a company with caching
   * @param id - Organization UUID
   * @param companyId - Company UUID for tenant isolation
   * @returns Promise resolving to organization entity if found
   */
  async findByIdAndCompanyId(
    id: string,
    companyId: string
  ): Promise<OrganizationEntity | null> {
    try {
      const organization = await this.findOne({
        where: { id, companyId } as FindOptionsWhere<OrganizationEntity>,
        cache: {
          id: `org_${id}_${companyId}`,
          milliseconds: 30000 // 30 second cache
        }
      });

      if (organization) {
        this.logger.debug('Retrieved organization', { id, companyId });
      } else {
        this.logger.warn('Organization not found', { id, companyId });
      }

      return organization;
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
   * Updates point configuration overrides with AI detection support
   * @param id - Organization UUID
   * @param pointOverrides - New point configuration
   * @param aiConfig - AI detection configuration
   * @returns Promise resolving to updated organization entity
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
    lastModifiedBy: string
  ): Promise<OrganizationEntity> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate point values
      const validPoints = Object.values(pointOverrides.basePoints).every(
        points => typeof points === 'number' && points >= 0
      );
      if (!validPoints) {
        throw new Error('Invalid point configuration values');
      }

      // Validate AI modifier
      if (
        typeof pointOverrides.aiModifier !== 'number' ||
        pointOverrides.aiModifier < 0 ||
        pointOverrides.aiModifier > 1
      ) {
        throw new Error('Invalid AI modifier value');
      }

      const organization = await queryRunner.manager.findOne(OrganizationEntity, {
        where: { id } as FindOptionsWhere<OrganizationEntity>
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Update point configuration
      organization.pointOverrides = pointOverrides;
      organization.lastModifiedBy = lastModifiedBy;

      const updatedOrg = await queryRunner.manager.save(organization);

      // Log the change
      this.logger.info('Updated organization point configuration', {
        id,
        pointOverrides,
        lastModifiedBy
      });

      await queryRunner.commitTransaction();

      // Invalidate cache
      await this.manager.connection.queryResultCache?.remove([
        `org_${id}_${organization.companyId}`
      ]);

      return updatedOrg;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to update point configuration', {
        id,
        error: error.message
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validates organization against company tier limits
   * @param companyId - Company UUID
   * @returns Promise resolving to boolean indicating if organization can be created
   */
  private async validateOrganizationLimits(companyId: string): Promise<boolean> {
    const company = await this.manager.findOne('CompanyEntity', {
      where: { id: companyId }
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const { total } = await this.findByCompanyId(companyId);
    const tierLimits = {
      SMALL: 1,
      MEDIUM: 5,
      ENTERPRISE: 100
    };

    return total < tierLimits[company.subscriptionTier];
  }
}