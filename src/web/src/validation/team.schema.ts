/**
 * @fileoverview Zod validation schemas for team-related data structures and operations.
 * Implements comprehensive validation rules for team management ensuring data integrity.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.0.0
import { Team, TeamMember, TeamSortField } from '../types/team.types';

/**
 * Constants for validation rules
 */
export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 50;
export const MAX_TEAM_MEMBERS = 100;
export const MAX_PAGE_SIZE = 50;

/**
 * Schema for team creation requests.
 * Enforces team name constraints and proper organization association.
 */
export const createTeamSchema = z.object({
  name: z.string()
    .trim()
    .min(TEAM_NAME_MIN_LENGTH, `Team name must be at least ${TEAM_NAME_MIN_LENGTH} characters`)
    .max(TEAM_NAME_MAX_LENGTH, `Team name cannot exceed ${TEAM_NAME_MAX_LENGTH} characters`),
  organizationId: z.string().uuid('Organization ID must be a valid UUID'),
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Schema for team update requests.
 * Allows partial updates while maintaining validation rules.
 */
export const updateTeamSchema = z.object({
  name: z.string()
    .trim()
    .min(TEAM_NAME_MIN_LENGTH, `Team name must be at least ${TEAM_NAME_MIN_LENGTH} characters`)
    .max(TEAM_NAME_MAX_LENGTH, `Team name cannot exceed ${TEAM_NAME_MAX_LENGTH} characters`)
    .optional(),
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
  isActive: z.boolean().optional(),
  version: z.string().uuid('Version must be a valid UUID').optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Schema for adding team members.
 * Validates member role assignment and proper ID formats.
 */
export const addTeamMemberSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  teamId: z.string().uuid('Team ID must be a valid UUID'),
  role: z.enum(['MEMBER', 'LEAD', 'ADMIN'], {
    errorMap: () => ({ message: 'Invalid team member role' })
  }),
  startDate: z.date().optional().default(() => new Date()),
  metadata: z.record(z.string(), z.any()).optional()
}).refine(
  async (data) => {
    // Custom refinement to check team member limit
    // Implementation would need to query current team size
    return true; // Placeholder for actual implementation
  },
  {
    message: `Team cannot exceed ${MAX_TEAM_MEMBERS} members`
  }
);

/**
 * Schema for team query parameters.
 * Enforces pagination limits and valid sorting options.
 */
export const teamQuerySchema = z.object({
  sortBy: z.nativeEnum(TeamSortField).optional(),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.number().int().min(1, 'Page must be greater than 0').optional().default(1),
  limit: z.number()
    .int()
    .min(1, 'Limit must be greater than 0')
    .max(MAX_PAGE_SIZE, `Cannot request more than ${MAX_PAGE_SIZE} items per page`)
    .optional()
    .default(20),
  search: z.string().max(100, 'Search term cannot exceed 100 characters').optional(),
  isActive: z.boolean().optional(),
  organizationId: z.string().uuid('Organization ID must be a valid UUID').optional()
});

/**
 * Schema for bulk team member operations.
 * Validates arrays of member updates while enforcing size limits.
 */
export const bulkTeamMemberSchema = z.object({
  teamId: z.string().uuid('Team ID must be a valid UUID'),
  members: z.array(z.string().uuid('Member ID must be a valid UUID'))
    .min(1, 'Must specify at least one member')
    .max(MAX_TEAM_MEMBERS, `Cannot process more than ${MAX_TEAM_MEMBERS} members at once`)
});

/**
 * Type inference helpers for TypeScript integration
 */
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type TeamQueryInput = z.infer<typeof teamQuerySchema>;
export type BulkTeamMemberInput = z.infer<typeof bulkTeamMemberSchema>;