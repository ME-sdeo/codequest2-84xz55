/**
 * @fileoverview Points History entity class for tracking point awards and calculations
 * with comprehensive audit support and AI detection integration
 * @version 1.0.0
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm'; // ^0.3.0
import { IsNotEmpty, Min } from 'class-validator'; // ^0.14.0
import { Activity } from './activity.entity';
import { ActivityType } from '../interfaces/activity.interface';
import { TeamMember } from './team-member.entity';

/**
 * Entity class representing the history of points awarded to team members
 * Implements comprehensive audit support and optimized querying capabilities
 */
@Entity('points_history')
@Index(['teamMemberId', 'createdAt'])
@Index(['activityId'])
@Index(['createdAt'])
@Index(['activityType', 'createdAt'])
export class PointsHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @IsNotEmpty()
  teamMemberId: string;

  @Column('uuid')
  @IsNotEmpty()
  activityId: string;

  @Column('integer')
  @Min(0)
  points: number;

  @Column({
    type: 'enum',
    enum: ActivityType
  })
  @IsNotEmpty()
  activityType: ActivityType;

  @Column('boolean', { default: false })
  isAiGenerated: boolean;

  @Column('integer')
  @Min(0)
  basePoints: number;

  @Column('decimal', { precision: 3, scale: 2, default: 1.0 })
  aiModifier: number;

  @Column('text', { nullable: true })
  calculationNotes: string;

  @Column('jsonb', { default: [] })
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    details: string;
  }>;

  @ManyToOne(() => TeamMember, { eager: false })
  @JoinColumn({ name: 'teamMemberId' })
  teamMember: TeamMember;

  @ManyToOne(() => Activity, { eager: false })
  @JoinColumn({ name: 'activityId' })
  activity: Activity;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Creates a new points history entry with validation and audit support
   * @param data - Partial points history data
   */
  constructor(data?: Partial<PointsHistory>) {
    if (data) {
      Object.assign(this, data);
      
      // Initialize audit trail if not provided
      if (!this.auditTrail) {
        this.auditTrail = [];
      }

      // Calculate points if not provided
      if (!this.points && this.basePoints) {
        this.points = this.calculateFinalPoints();
      }

      // Add initial audit entry
      this.updateAuditTrail(
        'CREATED',
        `Points history entry created with ${this.points} points`
      );
    }
  }

  /**
   * Calculates final points based on base points and AI modifier
   * Implements point calculation rules from technical specifications
   * @returns Final calculated points value
   */
  calculateFinalPoints(): number {
    let finalPoints = this.basePoints;
    const steps: string[] = [`Base points: ${this.basePoints}`];

    // Apply AI modifier if applicable
    if (this.isAiGenerated) {
      finalPoints *= this.aiModifier;
      steps.push(`Applied AI modifier (${this.aiModifier}): ${finalPoints}`);
    }

    // Round to nearest integer
    finalPoints = Math.round(finalPoints);
    steps.push(`Final points after rounding: ${finalPoints}`);

    // Update calculation notes
    this.calculationNotes = steps.join('\n');

    return finalPoints;
  }

  /**
   * Updates the audit trail with new changes
   * @param action - Action performed
   * @param details - Details of the action
   */
  updateAuditTrail(action: string, details: string): void {
    this.auditTrail.push({
      timestamp: new Date(),
      action,
      details
    });
    this.updatedAt = new Date();
  }
}