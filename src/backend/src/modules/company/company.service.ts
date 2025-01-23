/**
 * @fileoverview Company service implementing business logic for company management
 * Provides enhanced company operations with AI support, caching, and transaction handling
 * @version 1.0.0
 */

import { Injectable, UseInterceptors } from '@nestjs/common'; // ^10.0.0
import { RateLimiterService } from '@nestjs/throttler'; // ^5.0.0
import { CacheInterceptor } from '@nestjs/cache-manager'; // ^2.0.0
import { AuditService } from '@nestjs/audit'; // ^2.0.0

import { CompanyEntity } from '../../entities/company.entity';
import { CompanyRepository } from '../../repositories/company.repository';
import { 
  SubscriptionTier, 
  PointConfig, 
  isValidPointConfig,
  DEFAULT_AI_MODIFIER,
  TIER_LIMITS 
} from '../../interfaces/tenant.interface';

interface CreateCompanyDto {
  name: string;
  subscriptionTier: SubscriptionTier;
  pointConfig: PointConfig;
  aiModifiers: Record<string, number>;
}

@Injectable()
@UseInterceptors(CacheInterceptor)
export class CompanyService {
  private readonly RATE_LIMIT_TTL = 3600; // 1 hour
  private readonly MAX_COMPANY_CREATIONS = 10; // per hour
  private readonly MAX_CONFIG_UPDATES = 100; // per hour

  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly auditService: AuditService,
    private readonly rateLimiter: RateLimiterService
  ) {}

  /**
   * Creates a new company with AI-aware point configuration
   * @param createCompanyDto - Company creation data
   * @returns Promise resolving to created company
   * @throws Error if validation fails or rate limit exceeded
   */
  async createCompany(createCompanyDto: CreateCompanyDto): Promise<CompanyEntity> {
    // Check rate limit for company creation
    await this.rateLimiter.checkLimit({
      ttl: this.RATE_LIMIT_TTL,
      limit: this.MAX_COMPANY_CREATIONS,
      key: 'company_creation'
    });

    // Validate company name uniqueness
    const existingCompany = await this.companyRepository.findByName(createCompanyDto.name);
    if (existingCompany) {
      throw new Error('Company name already exists');
    }

    // Validate point configuration and AI modifiers
    if (!isValidPointConfig(createCompanyDto.pointConfig)) {
      throw new Error('Invalid point configuration');
    }

    // Validate subscription tier limits
    const tierLimits = TIER_LIMITS[createCompanyDto.subscriptionTier];
    if (!tierLimits) {
      throw new Error('Invalid subscription tier');
    }

    try {
      // Create new company entity
      const company = new CompanyEntity(
        createCompanyDto.name,
        createCompanyDto.subscriptionTier,
        createCompanyDto.pointConfig,
        {
          ...createCompanyDto.aiModifiers,
          defaultModifier: DEFAULT_AI_MODIFIER
        }
      );

      // Save with transaction support
      const savedCompany = await this.companyRepository.save(company);

      // Audit logging
      await this.auditService.log({
        action: 'company.create',
        entityType: 'company',
        entityId: savedCompany.id,
        changes: createCompanyDto
      });

      return savedCompany;
    } catch (error) {
      throw new Error(`Failed to create company: ${error.message}`);
    }
  }

  /**
   * Updates company point configuration with AI detection support
   * @param id - Company UUID
   * @param pointConfig - New point configuration
   * @param aiModifiers - AI detection modifiers
   * @returns Promise resolving to updated company
   * @throws Error if validation fails or rate limit exceeded
   */
  async updatePointConfigWithAI(
    id: string,
    pointConfig: PointConfig,
    aiModifiers: Record<string, number>
  ): Promise<CompanyEntity> {
    // Check rate limit for configuration updates
    await this.rateLimiter.checkLimit({
      ttl: this.RATE_LIMIT_TTL,
      limit: this.MAX_CONFIG_UPDATES,
      key: `company_config_update:${id}`
    });

    // Validate company exists with current config
    const company = await this.companyRepository.findWithOrganizations(id, { 
      loadOrganizations: true 
    });
    if (!company) {
      throw new Error('Company not found');
    }

    // Validate point configuration
    if (!isValidPointConfig(pointConfig)) {
      throw new Error('Invalid point configuration');
    }

    // Validate AI modifiers
    const requiredActivities = [
      'codeCheckIn',
      'pullRequest',
      'codeReview',
      'bugFix',
      'storyClosure'
    ];

    const hasValidModifiers = requiredActivities.every(
      activity => typeof aiModifiers[activity] === 'number' &&
                  aiModifiers[activity] >= 0 &&
                  aiModifiers[activity] <= 1
    );

    if (!hasValidModifiers) {
      throw new Error('Invalid AI modifiers');
    }

    try {
      // Update configuration with transaction support
      const updatedCompany = await this.companyRepository.updatePointConfig(id, {
        ...pointConfig,
        aiModifier: DEFAULT_AI_MODIFIER
      });

      // Update AI modifiers
      updatedCompany.aiModifiers = {
        ...aiModifiers,
        defaultModifier: DEFAULT_AI_MODIFIER
      };

      const savedCompany = await this.companyRepository.save(updatedCompany);

      // Audit logging
      await this.auditService.log({
        action: 'company.update_point_config',
        entityType: 'company',
        entityId: id,
        changes: {
          pointConfig,
          aiModifiers
        }
      });

      return savedCompany;
    } catch (error) {
      throw new Error(`Failed to update point configuration: ${error.message}`);
    }
  }
}