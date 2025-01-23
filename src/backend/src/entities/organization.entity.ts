/**
 * @fileoverview Organization entity class for CodeQuest's multi-tenant architecture
 * Implements database schema and relationships for organizations with AI-aware point configuration
 * @version 1.0.0
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm'; // v0.3.0

import { CompanyEntity } from './company.entity';
import { TenantConfig } from '../interfaces/tenant.interface';

/**
 * Entity class representing an organization within a company tenant
 * Implements organization-level point configuration with AI detection support
 */
@Entity('organizations')
@Index(['companyId'])
@Index(['name'])
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ 
    type: 'varchar', 
    length: 255, 
    nullable: false 
  })
  name: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => CompanyEntity, company => company.organizations, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'companyId' })
  company: CompanyEntity;

  @OneToMany(() => Promise.resolve().then(() => require('./team.entity').TeamEntity),
    team => team.organization, {
    cascade: true,
    lazy: true
  })
  teams: Promise<any[]>;

  @Column({
    type: 'jsonb',
    nullable: true,
    default: null
  })
  pointOverrides: {
    basePoints: {
      codeCheckIn: number;
      pullRequest: number;
      codeReview: number;
      bugFix: number;
      storyClosure: number;
    };
    aiModifier: number;
  };

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  lastModifiedBy: string;

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

  /**
   * Creates a new organization entity instance
   * @param name - Organization name
   * @param companyId - Parent company ID
   * @param pointOverrides - Optional point configuration overrides
   * @param lastModifiedBy - User creating the organization
   */
  constructor(
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
    lastModifiedBy?: string
  ) {
    if (name) {
      this.name = name;
      this.companyId = companyId;
      this.pointOverrides = pointOverrides || null;
      this.lastModifiedBy = lastModifiedBy || null;
    }
  }

  /**
   * Retrieves effective point configuration by merging company defaults with organization overrides
   * and applying AI modifiers
   * @param isAIGenerated - Whether the activity was AI-generated
   * @returns Effective point configuration with AI adjustments
   */
  async getEffectivePointConfig(isAIGenerated: boolean): Promise<{
    codeCheckIn: number;
    pullRequest: number;
    codeReview: number;
    bugFix: number;
    storyClosure: number;
  }> {
    // Get company base configuration
    const company = await Promise.resolve(this.company);
    const baseConfig = company.pointConfig.basePoints;
    const baseAiModifier = company.pointConfig.aiModifier;

    // If no organization overrides, use company config
    if (!this.pointOverrides) {
      const modifier = isAIGenerated ? baseAiModifier : 1;
      return {
        codeCheckIn: baseConfig.codeCheckIn * modifier,
        pullRequest: baseConfig.pullRequest * modifier,
        codeReview: baseConfig.codeReview * modifier,
        bugFix: baseConfig.bugFix * modifier,
        storyClosure: baseConfig.storyClosure * modifier
      };
    }

    // Merge organization overrides with company config
    const effectivePoints = {
      codeCheckIn: this.pointOverrides.basePoints.codeCheckIn || baseConfig.codeCheckIn,
      pullRequest: this.pointOverrides.basePoints.pullRequest || baseConfig.pullRequest,
      codeReview: this.pointOverrides.basePoints.codeReview || baseConfig.codeReview,
      bugFix: this.pointOverrides.basePoints.bugFix || baseConfig.bugFix,
      storyClosure: this.pointOverrides.basePoints.storyClosure || baseConfig.storyClosure
    };

    // Apply AI modifier if applicable
    if (isAIGenerated) {
      const aiModifier = this.pointOverrides.aiModifier || baseAiModifier;
      return {
        codeCheckIn: effectivePoints.codeCheckIn * aiModifier,
        pullRequest: effectivePoints.pullRequest * aiModifier,
        codeReview: effectivePoints.codeReview * aiModifier,
        bugFix: effectivePoints.bugFix * aiModifier,
        storyClosure: effectivePoints.storyClosure * aiModifier
      };
    }

    return effectivePoints;
  }

  /**
   * Validates organization creation against company tier limits
   * @throws Error if organization creation would exceed company tier limits
   */
  @BeforeInsert()
  @BeforeUpdate()
  async validateOrganizationLimits(): Promise<void> {
    const company = await Promise.resolve(this.company);
    const organizations = await company.organizations;
    
    const tierLimits = {
      SMALL: 1,
      MEDIUM: 5,
      ENTERPRISE: 100
    };

    const maxOrgs = tierLimits[company.subscriptionTier];
    
    if (organizations.length >= maxOrgs) {
      throw new Error(`Organization limit of ${maxOrgs} reached for ${company.subscriptionTier} tier`);
    }
  }
}