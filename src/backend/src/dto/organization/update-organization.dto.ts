/**
 * @fileoverview DTO for validating organization update operations including point configuration
 * Implements strict validation for organization properties and point calculation overrides
 * @version 1.0.0
 */

import { IsString, IsOptional, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PointConfig } from '../../interfaces/tenant.interface';

/**
 * Data Transfer Object for updating organization properties
 * Supports organization name updates and point configuration overrides
 * Implements validation requirements from technical specification 1.3 SCOPE
 */
export class UpdateOrganizationDto {
  /**
   * Organization name with required string validation
   * Must be non-empty as per organization management requirements
   */
  @IsString({ message: 'Organization name must be a string' })
  @IsNotEmpty({ message: 'Organization name cannot be empty' })
  name: string;

  /**
   * Optional point configuration overrides for organization-specific rules
   * Implements point calculation requirements from A.1.1
   * Supports custom base points and AI modifiers at organization level
   */
  @IsOptional()
  @ValidateNested({ message: 'Point overrides must be a valid configuration' })
  @Type(() => PointConfig)
  pointOverrides?: PointConfig;
}