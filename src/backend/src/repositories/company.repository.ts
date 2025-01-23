/**
 * @fileoverview Company repository implementation for CodeQuest's multi-tenant architecture
 * Provides optimized database operations with caching and transaction support
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // ^10.0.0
import { Repository, EntityRepository, QueryRunner } from 'typeorm'; // v0.3.x
import { CacheManager } from '@nestjs/cache-manager'; // ^2.0.0
import { CompanyEntity } from '../entities/company.entity';
import { TenantConfig, SubscriptionTier, PointConfig, isValidPointConfig, isValidSubscriptionTier } from '../interfaces/tenant.interface';

/**
 * Repository class for managing company entities with enhanced caching and transaction support
 */
@Injectable()
@EntityRepository(CompanyEntity)
export class CompanyRepository extends Repository<CompanyEntity> {
  private readonly CACHE_TTL = 3600; // 1 hour cache TTL
  private readonly CACHE_PREFIX = 'company:';

  constructor(
    private readonly cacheManager: CacheManager
  ) {
    super();
  }

  /**
   * Find a company by its name with caching support
   * @param name - Company name to search for
   * @returns Promise resolving to found company or null
   */
  async findByName(name: string): Promise<CompanyEntity | null> {
    const cacheKey = `${this.CACHE_PREFIX}name:${name}`;
    
    // Try to get from cache first
    const cached = await this.cacheManager.get<CompanyEntity>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const company = await this.createQueryBuilder('company')
        .where('company.name = :name', { name })
        .cache(true)
        .setQueryRunner(this.manager.queryRunner)
        .getOne();

      if (company) {
        await this.cacheManager.set(cacheKey, company, this.CACHE_TTL);
      }

      return company;
    } catch (error) {
      throw new Error(`Error finding company by name: ${error.message}`);
    }
  }

  /**
   * Find company with its organizations using selective loading
   * @param id - Company UUID
   * @param options - Load options for relations
   * @returns Promise resolving to company with selected relations
   */
  async findWithOrganizations(
    id: string,
    options: { loadOrganizations?: boolean; loadTeams?: boolean } = {}
  ): Promise<CompanyEntity | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}:${JSON.stringify(options)}`;
    
    const cached = await this.cacheManager.get<CompanyEntity>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queryBuilder = this.createQueryBuilder('company')
        .where('company.id = :id', { id });

      if (options.loadOrganizations) {
        queryBuilder.leftJoinAndSelect('company.organizations', 'organization');
        
        if (options.loadTeams) {
          queryBuilder.leftJoinAndSelect('organization.teams', 'team');
        }
      }

      const company = await queryBuilder
        .cache(true)
        .setQueryRunner(this.manager.queryRunner)
        .getOne();

      if (company) {
        await this.cacheManager.set(cacheKey, company, this.CACHE_TTL);
      }

      return company;
    } catch (error) {
      throw new Error(`Error finding company with organizations: ${error.message}`);
    }
  }

  /**
   * Update company point configuration with transaction support
   * @param id - Company UUID
   * @param pointConfig - New point configuration
   * @returns Promise resolving to updated company
   */
  async updatePointConfig(
    id: string,
    pointConfig: PointConfig
  ): Promise<CompanyEntity> {
    if (!isValidPointConfig(pointConfig)) {
      throw new Error('Invalid point configuration');
    }

    const queryRunner = this.manager.queryRunner || await this.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.startTransaction();
      
      const company = await queryRunner.manager
        .createQueryBuilder(CompanyEntity, 'company')
        .setLock('pessimistic_write')
        .where('company.id = :id', { id })
        .getOne();

      if (!company) {
        throw new Error('Company not found');
      }

      company.pointConfig = pointConfig;
      const updated = await queryRunner.manager.save(company);
      
      await queryRunner.commitTransaction();
      
      // Invalidate cache
      await this.cacheManager.del(`${this.CACHE_PREFIX}${id}`);
      await this.cacheManager.del(`${this.CACHE_PREFIX}name:${company.name}`);

      return updated;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new Error(`Error updating point config: ${error.message}`);
    } finally {
      if (!this.manager.queryRunner) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Update company subscription tier with validation
   * @param id - Company UUID
   * @param tier - New subscription tier
   * @returns Promise resolving to updated company
   */
  async updateSubscriptionTier(
    id: string,
    tier: SubscriptionTier
  ): Promise<CompanyEntity> {
    if (!isValidSubscriptionTier(tier)) {
      throw new Error('Invalid subscription tier');
    }

    const queryRunner = this.manager.queryRunner || await this.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.startTransaction();
      
      const company = await queryRunner.manager
        .createQueryBuilder(CompanyEntity, 'company')
        .setLock('pessimistic_write')
        .where('company.id = :id', { id })
        .getOne();

      if (!company) {
        throw new Error('Company not found');
      }

      company.subscriptionTier = tier;
      const updated = await queryRunner.manager.save(company);
      
      await queryRunner.commitTransaction();
      
      // Invalidate cache
      await this.cacheManager.del(`${this.CACHE_PREFIX}${id}`);
      await this.cacheManager.del(`${this.CACHE_PREFIX}name:${company.name}`);

      return updated;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new Error(`Error updating subscription tier: ${error.message}`);
    } finally {
      if (!this.manager.queryRunner) {
        await queryRunner.release();
      }
    }
  }
}