/**
 * @fileoverview Company entity class for CodeQuest's multi-tenant architecture
 * Implements database schema and relationships for companies with AI-aware point configurations
 * @version 1.0.0
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm'; // v0.3.x
import {
  TenantConfig,
  SubscriptionTier,
  PointConfig,
  isValidSubscriptionTier,
  isValidPointConfig,
  TIER_LIMITS
} from '../interfaces/tenant.interface';

/**
 * Entity class representing a company in the multi-tenant architecture
 * Implements strict tenant isolation with enhanced point configuration support
 */
@Entity('companies')
@Index(['subscriptionTier'])
@Index('idx_point_config_gin', ['pointConfig'], { using: 'gin' })
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index()
  name: string;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.SMALL
  })
  subscriptionTier: SubscriptionTier;

  @Column({
    type: 'jsonb',
    nullable: false
  })
  pointConfig: PointConfig;

  @Column({
    type: 'jsonb',
    nullable: false,
    default: {
      codeCheckIn: 0.75,
      pullRequest: 0.75,
      codeReview: 0.75,
      bugFix: 0.75,
      storyClosure: 0.75
    }
  })
  aiModifiers: Record<string, number>;

  @OneToMany(() => Promise.resolve().then(() => require('./organization.entity').OrganizationEntity), 
    organization => organization.company, {
    cascade: true,
    lazy: true
  })
  organizations: Promise<any[]>;

  @CreateDateColumn({
    type: 'timestamptz',
    precision: 6
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    precision: 6
  })
  updatedAt: Date;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  lastModifiedBy: string;

  /**
   * Creates a new company entity with enhanced point configuration
   * @param name - Company name
   * @param subscriptionTier - Company subscription tier
   * @param pointConfig - Initial point configuration
   * @param aiModifiers - AI detection point modifiers
   */
  constructor(
    name: string,
    subscriptionTier: SubscriptionTier,
    pointConfig: PointConfig,
    aiModifiers: Record<string, number>
  ) {
    this.validateConstructorParams(name, subscriptionTier, pointConfig, aiModifiers);
    
    this.name = name;
    this.subscriptionTier = subscriptionTier;
    this.pointConfig = pointConfig;
    this.aiModifiers = aiModifiers;
  }

  /**
   * Validates point configuration including AI modifiers
   * @param config - Point configuration to validate
   * @param aiModifiers - AI detection modifiers to validate
   * @returns Boolean indicating if configuration is valid
   */
  validatePointConfig(
    config: PointConfig,
    aiModifiers: Record<string, number>
  ): boolean {
    if (!isValidPointConfig(config)) {
      return false;
    }

    // Validate AI modifiers
    const requiredActivities = [
      'codeCheckIn',
      'pullRequest',
      'codeReview',
      'bugFix',
      'storyClosure'
    ];

    const hasAllModifiers = requiredActivities.every(
      activity => typeof aiModifiers[activity] === 'number' &&
                  aiModifiers[activity] >= 0 &&
                  aiModifiers[activity] <= 1
    );

    if (!hasAllModifiers) {
      return false;
    }

    // Validate organization override limits based on subscription tier
    const tierLimits = TIER_LIMITS[this.subscriptionTier];
    const orgOverrideCount = Object.keys(config.orgOverrides || {}).length;

    return orgOverrideCount <= tierLimits.maxOrgs;
  }

  /**
   * Validates constructor parameters
   * @private
   */
  private validateConstructorParams(
    name: string,
    subscriptionTier: SubscriptionTier,
    pointConfig: PointConfig,
    aiModifiers: Record<string, number>
  ): void {
    if (!name || name.length === 0 || name.length > 255) {
      throw new Error('Invalid company name');
    }

    if (!isValidSubscriptionTier(subscriptionTier)) {
      throw new Error('Invalid subscription tier');
    }

    if (!this.validatePointConfig(pointConfig, aiModifiers)) {
      throw new Error('Invalid point configuration or AI modifiers');
    }
  }

  /**
   * Updates the company's point configuration
   * @param newConfig - New point configuration
   * @param newAiModifiers - New AI modifiers
   * @param modifiedBy - User making the modification
   */
  updatePointConfiguration(
    newConfig: PointConfig,
    newAiModifiers: Record<string, number>,
    modifiedBy: string
  ): void {
    if (!this.validatePointConfig(newConfig, newAiModifiers)) {
      throw new Error('Invalid point configuration update');
    }

    this.pointConfig = newConfig;
    this.aiModifiers = newAiModifiers;
    this.lastModifiedBy = modifiedBy;
  }

  /**
   * Updates the company's subscription tier
   * @param newTier - New subscription tier
   * @param modifiedBy - User making the modification
   */
  updateSubscriptionTier(
    newTier: SubscriptionTier,
    modifiedBy: string
  ): void {
    if (!isValidSubscriptionTier(newTier)) {
      throw new Error('Invalid subscription tier');
    }

    this.subscriptionTier = newTier;
    this.lastModifiedBy = modifiedBy;
  }
}