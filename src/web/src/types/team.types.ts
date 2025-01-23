/**
 * @fileoverview TypeScript type definitions for team-related data structures in CodeQuest.
 * Provides interfaces and types for managing teams, team members, achievements, and points.
 * @version 1.0.0
 */

import { BaseEntity, TenantEntity } from '../types/common.types';

/**
 * Interface representing a team within an organization.
 * Extends BaseEntity for common fields and TenantEntity for multi-tenant support.
 */
export interface Team extends BaseEntity, TenantEntity {
  /** Team display name */
  name: string;
  /** Aggregate points earned by all team members */
  totalPoints: number;
  /** Current count of team members */
  memberCount: number;
  /** Array of team members */
  members: TeamMember[];
  /** Flag indicating if team is currently active */
  isActive: boolean;
  /** Timestamp of last recorded team activity */
  lastActivityAt: Date;
  /** Team version for optimistic concurrency */
  version: string;
  /** Additional team metadata */
  metadata: Record<string, any>;
}

/**
 * Interface representing a member of a team.
 * Extends BaseEntity for common fields.
 */
export interface TeamMember extends BaseEntity {
  /** Reference to parent team */
  teamId: string;
  /** Reference to user entity */
  userId: string;
  /** Total points earned by member */
  totalPoints: number;
  /** Current achievement level */
  currentLevel: number;
  /** Array of earned achievements */
  achievements: Achievement[];
  /** Timestamp when member joined team */
  joinedAt: Date;
  /** Timestamp of last member activity */
  lastActivityAt: Date;
  /** Historical point earnings */
  pointsHistory: PointHistory[];
  /** Computed active status */
  readonly isActive: boolean;
}

/**
 * Interface representing a team member's achievement.
 */
export interface Achievement {
  /** Unique achievement identifier */
  id: string;
  /** Achievement display name */
  name: string;
  /** Achievement description */
  description: string;
  /** URL to achievement badge image */
  badgeUrl: string;
  /** Timestamp when achievement was earned */
  earnedAt: Date;
  /** Achievement category */
  category: string;
  /** Achievement level requirement */
  level: number;
}

/**
 * Interface for team API responses.
 */
export interface TeamResponse {
  /** Team data */
  team: Team;
  /** Team statistics */
  stats: TeamStats;
  /** Array of any errors */
  errors: TeamError[];
}

/**
 * Interface for team statistics.
 */
export interface TeamStats {
  /** Total team points */
  totalPoints: number;
  /** Average points per member */
  averagePoints: number;
  /** Count of active team members */
  activeMembers: number;
  /** Highest level achieved in team */
  topLevel: number;
  /** Points earned this week */
  weeklyPoints: number;
  /** Points earned this month */
  monthlyPoints: number;
  /** Total achievements earned */
  achievementCount: number;
  /** Custom team metrics */
  customMetrics: Record<string, number>;
}

/**
 * Interface for tracking point history.
 */
export interface PointHistory {
  /** When points were earned */
  timestamp: Date;
  /** Number of points earned */
  points: number;
  /** Type of activity that earned points */
  activityType: ActivityType;
  /** Whether points were earned from AI-generated code */
  isAIGenerated: boolean;
  /** Description of the activity */
  description: string;
}

/**
 * Interface for team-related errors.
 */
export interface TeamError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Field causing error */
  field: string;
  /** Additional error details */
  details: any;
}

/**
 * Enumeration of available team sorting fields.
 */
export enum TeamSortField {
  NAME = 'name',
  TOTAL_POINTS = 'totalPoints',
  MEMBER_COUNT = 'memberCount',
  CREATED_AT = 'createdAt',
  LAST_ACTIVITY_AT = 'lastActivityAt'
}

/**
 * Enumeration of available team member sorting fields.
 */
export enum TeamMemberSortField {
  TOTAL_POINTS = 'totalPoints',
  CURRENT_LEVEL = 'currentLevel',
  JOINED_AT = 'joinedAt',
  LAST_ACTIVITY_AT = 'lastActivityAt'
}

/**
 * Enumeration of activity types for point history.
 */
export enum ActivityType {
  COMMIT = 'COMMIT',
  PULL_REQUEST = 'PULL_REQUEST',
  CODE_REVIEW = 'CODE_REVIEW',
  BUG_FIX = 'BUG_FIX',
  STORY_COMPLETION = 'STORY_COMPLETION'
}