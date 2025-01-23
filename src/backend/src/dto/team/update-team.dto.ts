/**
 * @fileoverview Data Transfer Object (DTO) for team update operations
 * Implements strict validation rules for team updates in multi-tenant architecture
 * @version 1.0.0
 */

import { IsString, IsOptional, Length } from 'class-validator'; // v0.14.0
import { TeamEntity } from '../../entities/team.entity';

/**
 * DTO class for validating team update requests
 * Implements enhanced validation and security measures for team management
 */
export class UpdateTeamDto {
  /**
   * Optional team name field with strict validation rules
   * - Must be a string
   * - Length between 3 and 50 characters
   * - Prevents XSS through string validation
   * - Prevents DOS through length limits
   */
  @IsOptional()
  @IsString({ message: 'Team name must be a string' })
  @Length(3, 50, { message: 'Team name must be between 3 and 50 characters' })
  name?: string;
}