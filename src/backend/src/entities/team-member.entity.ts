/**
 * @fileoverview Team member entity class for CodeQuest platform implementing comprehensive 
 * team member management with points tracking and AI code detection support
 * @version 1.0.0
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm'; // v0.3.0

import { TeamEntity } from './team.entity';
import { UserEntity } from './user.entity';

/**
 * Interface for achievement records
 */
interface Achievement {
  id: string;
  name: string;
  description: string;
  awardedAt: Date;
  type: 'level' | 'points' | 'activity';
  metadata?: Record<string, any>;
}

/**
 * Interface for point history records
 */
interface PointHistory {
  points: number;
  activityType: string;
  isAIGenerated: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Entity class representing a team member with points tracking and AI detection support
 */
@Entity('team_members')
@Index(['teamId', 'userId'], { unique: true })
@Index(['totalPoints'])
@Index(['currentLevel'])
export class TeamMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  teamId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => TeamEntity, team => team.members, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'teamId' })
  team: TeamEntity;

  @ManyToOne(() => UserEntity, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({
    type: 'integer',
    default: 0
  })
  totalPoints: number;

  @Column({
    type: 'integer',
    default: 1
  })
  currentLevel: number;

  @Column({
    type: 'jsonb',
    default: []
  })
  achievements: Achievement[];

  @Column({
    type: 'jsonb',
    default: []
  })
  pointHistory: PointHistory[];

  @Column({
    type: 'timestamptz',
    nullable: false
  })
  joinedAt: Date;

  @Column({
    type: 'timestamptz',
    nullable: true
  })
  lastPointsAwarded: Date | null;

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
   * Creates a new team member entity instance
   * @param teamId - ID of the team
   * @param userId - ID of the user
   */
  constructor(teamId: string, userId: string) {
    if (teamId && userId) {
      this.teamId = teamId;
      this.userId = userId;
      this.totalPoints = 0;
      this.currentLevel = 1;
      this.achievements = [];
      this.pointHistory = [];
      this.joinedAt = new Date();
      this.lastPointsAwarded = null;
    }
  }

  /**
   * Adds points to the team member's total with AI detection support
   * @param points - Points to add
   * @param isAIGenerated - Whether the activity was AI-generated
   * @param activityType - Type of activity that earned the points
   * @returns New total points value
   */
  async addPoints(
    points: number,
    isAIGenerated: boolean,
    activityType: string
  ): Promise<number> {
    if (points <= 0) {
      throw new Error('Points must be a positive number');
    }

    // Apply AI modifier if applicable
    const adjustedPoints = isAIGenerated ? Math.floor(points * 0.75) : points;

    // Update total points
    this.totalPoints += adjustedPoints;

    // Record point history
    const pointRecord: PointHistory = {
      points: adjustedPoints,
      activityType,
      isAIGenerated,
      timestamp: new Date(),
      metadata: {
        originalPoints: points,
        aiModifier: isAIGenerated ? 0.75 : 1
      }
    };
    this.pointHistory.push(pointRecord);

    // Update timestamps
    this.lastPointsAwarded = new Date();
    this.updatedAt = new Date();

    // Check for level up
    await this.checkLevelUp();

    // Update team's total points
    await this.team.updateTotalPoints(adjustedPoints, isAIGenerated);

    return this.totalPoints;
  }

  /**
   * Checks and updates the member's level based on total points
   * @returns Boolean indicating if level up occurred
   */
  async checkLevelUp(): Promise<boolean> {
    const pointsPerLevel = 1000;
    const calculatedLevel = Math.floor(this.totalPoints / pointsPerLevel) + 1;

    if (calculatedLevel > this.currentLevel) {
      const previousLevel = this.currentLevel;
      this.currentLevel = calculatedLevel;

      // Record level up achievement
      const achievement: Achievement = {
        id: crypto.randomUUID(),
        name: `Level ${calculatedLevel}`,
        description: `Reached level ${calculatedLevel}`,
        awardedAt: new Date(),
        type: 'level',
        metadata: {
          previousLevel,
          pointsAtLevel: this.totalPoints
        }
      };
      this.achievements.push(achievement);

      this.updatedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Adds a new achievement with validation
   * @param achievement - Achievement to add
   */
  addAchievement(achievement: Omit<Achievement, 'id' | 'awardedAt'>): void {
    if (!achievement.name || !achievement.description || !achievement.type) {
      throw new Error('Invalid achievement: missing required fields');
    }

    // Check for duplicate achievements
    const isDuplicate = this.achievements.some(
      existing => existing.name === achievement.name
    );
    if (isDuplicate) {
      throw new Error('Achievement already exists');
    }

    const newAchievement: Achievement = {
      ...achievement,
      id: crypto.randomUUID(),
      awardedAt: new Date()
    };

    this.achievements.push(newAchievement);
    this.updatedAt = new Date();
  }
}