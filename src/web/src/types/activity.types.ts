/**
 * @fileoverview TypeScript type definitions for Azure DevOps activities in the CodeQuest frontend.
 * Defines activity structures, metadata, and display configurations for the points-based reward system.
 * @version 1.0.0
 */

import { BaseEntity, TenantEntity } from './common.types';

/**
 * Enumeration of supported Azure DevOps activity types.
 * Maps to point-earning activities in the system.
 */
export enum ActivityType {
  CODE_CHECKIN = 'CODE_CHECKIN',
  PULL_REQUEST = 'PULL_REQUEST',
  CODE_REVIEW = 'CODE_REVIEW',
  BUG_FIX = 'BUG_FIX',
  STORY_CLOSURE = 'STORY_CLOSURE'
}

/**
 * Interface for Azure DevOps activity metadata.
 * Contains ADO-specific details and references.
 */
export interface ActivityMetadata {
  /** Azure DevOps unique identifier */
  adoId: string;
  /** Repository where the activity occurred */
  repository: string;
  /** Branch name for branch-specific activities */
  branch?: string;
  /** Direct URL to the activity in Azure DevOps */
  url: string;
  /** Activity title or summary */
  title: string;
  /** Detailed description of the activity */
  description?: string;
}

/**
 * Core activity interface extending base entity types.
 * Represents a tracked Azure DevOps activity with points and metadata.
 */
export interface Activity extends BaseEntity, TenantEntity {
  /** Type of Azure DevOps activity */
  type: ActivityType;
  /** ID of the team member who performed the activity */
  teamMemberId: string;
  /** Points earned for this activity */
  points: number;
  /** Flag indicating if AI-generated code was detected */
  isAiGenerated: boolean;
  /** Additional Azure DevOps metadata */
  metadata: ActivityMetadata;
}

/**
 * Interface for activity display configuration in UI components.
 * Controls how activities are rendered in the frontend.
 */
export interface ActivityDisplayConfig {
  /** User-friendly name for the activity type */
  displayName: string;
  /** Icon identifier for visual representation */
  icon: string;
  /** Base point value before modifiers */
  basePoints: number;
  /** Modifier applied to AI-generated activities */
  aiModifier: number = 0.75;
}

/**
 * Combined interface for activity feed items.
 * Pairs activity data with its display configuration.
 */
export interface ActivityFeedItem {
  /** Activity data */
  activity: Activity;
  /** Display configuration for the activity */
  displayConfig: ActivityDisplayConfig;
}