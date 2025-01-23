/**
 * @fileoverview Enhanced team entity class for CodeQuest's multi-tenant architecture
 * Implements database schema and relationships for teams with AI-aware point tracking
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
  Index
} from 'typeorm'; // v0.3.0

import { OrganizationEntity } from './organization.entity';
import { TenantConfig } from '../interfaces/tenant.interface';

/**
 * Entity class representing a team within an organization
 * Implements enhanced point tracking with AI detection support
 */
@Entity('teams')
@Index(['organizationId'], { where: 'deleted_at IS NULL' })
@Index(['name', 'organizationId'], { unique: true })
@Index(['totalPoints', 'organizationId'])
@Index(['memberCount', 'organizationId'])
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  name: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, organization => organization.teams, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @OneToMany(() => Promise.resolve().then(() => require('./team-member.entity').TeamMemberEntity),
    member => member.team, {
    cascade: true,
    lazy: true
  })
  members: Promise<any[]>;

  @Column({
    type: 'integer',
    default: 0
  })
  totalPoints: number;

  @Column({
    type: 'integer',
    default: 0
  })
  memberCount: number;

  @Column({
    type: 'integer',
    default: 0
  })
  aiGeneratedPoints: number;

  @Column({
    type: 'integer',
    default: 0
  })
  standardPoints: number;

  @Column({
    type: 'integer',
    nullable: false
  })
  maxMembers: number;

  @OneToMany(() => Promise.resolve().then(() => require('./point-audit-log.entity').PointAuditLogEntity),
    log => log.team, {
    cascade: true,
    lazy: true
  })
  pointHistory: Promise<any[]>;

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
    type: 'timestamptz',
    nullable: true
  })
  deletedAt: Date;

  /**
   * Creates a new team entity instance with enhanced initialization
   * @param name - Team name
   * @param organizationId - Parent organization ID
   * @param maxMembers - Maximum allowed team members
   */
  constructor(
    name: string,
    organizationId: string,
    maxMembers: number
  ) {
    if (name) {
      this.name = name;
      this.organizationId = organizationId;
      this.totalPoints = 0;
      this.aiGeneratedPoints = 0;
      this.standardPoints = 0;
      this.memberCount = 0;
      this.maxMembers = this.validateMaxMembers(maxMembers);
      this.createdAt = new Date();
    }
  }

  /**
   * Updates team points with AI detection support
   * @param pointDelta - Points to add/subtract
   * @param isAIGenerated - Whether the activity was AI-generated
   * @returns New total points value
   */
  async updateTotalPoints(
    pointDelta: number,
    isAIGenerated: boolean
  ): Promise<number> {
    const pointConfig = await this.getPointConfig();
    const adjustedPoints = isAIGenerated ? 
      pointDelta * pointConfig.aiModifier :
      pointDelta;

    if (isAIGenerated) {
      this.aiGeneratedPoints += adjustedPoints;
    } else {
      this.standardPoints += adjustedPoints;
    }

    this.totalPoints = this.aiGeneratedPoints + this.standardPoints;
    this.updatedAt = new Date();

    return this.totalPoints;
  }

  /**
   * Retrieves point configuration with AI modifiers
   * @returns Team's effective point configuration
   */
  async getPointConfig(): Promise<TenantConfig['pointConfig']> {
    const organization = await Promise.resolve(this.organization);
    return organization.getEffectivePointConfig(true);
  }

  /**
   * Validates member operations with capacity checks
   * @param operation - Operation type ('add' or 'remove')
   * @param count - Number of members affected
   * @returns Operation validity
   */
  validateMemberOperation(
    operation: 'add' | 'remove',
    count: number = 1
  ): boolean {
    if (operation === 'add') {
      return (this.memberCount + count) <= this.maxMembers;
    }
    return (this.memberCount - count) >= 0;
  }

  /**
   * Validates maximum members against subscription tier limits
   * @private
   */
  private validateMaxMembers(maxMembers: number): number {
    if (maxMembers <= 0) {
      throw new Error('Maximum members must be greater than 0');
    }
    // Additional validation can be added based on subscription tier
    return maxMembers;
  }
}