/**
 * @fileoverview Data Transfer Object (DTO) for team creation requests
 * Implements comprehensive validation rules and type safety for creating new teams
 * within organizations while ensuring proper tenant isolation and data integrity
 * @version 1.0.0
 */

import { IsString, IsUUID, IsNotEmpty, Length } from 'class-validator'; // v0.14.0
import { TeamEntity } from '../../entities/team.entity';

/**
 * DTO class for validating team creation requests
 * Ensures proper team naming conventions and valid organization association
 */
export class CreateTeamDto {
  /**
   * Team name with strict validation rules:
   * - Must be a non-empty string
   * - Length between 3 and 255 characters to match entity constraints
   * - Required field for team creation
   */
  @IsString({ message: 'Team name must be a string' })
  @IsNotEmpty({ message: 'Team name is required' })
  @Length(3, 255, {
    message: 'Team name must be between 3 and 255 characters'
  })
  name: string;

  /**
   * Organization ID with UUID v4 validation:
   * - Must be a valid UUID v4 format
   * - Required for proper tenant isolation
   * - Links team to correct organization context
   */
  @IsUUID('4', { message: 'Organization ID must be a valid UUID v4' })
  @IsNotEmpty({ message: 'Organization ID is required' })
  organizationId: string;
}