/**
 * @fileoverview Data Transfer Object for creating a new organization within a company tenant
 * Implements validation rules, point configuration overrides, and Swagger documentation
 * @version 1.0.0
 */

import { IsString, IsNotEmpty, IsUUID, IsOptional, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PointConfig } from '../../interfaces/tenant.interface';

/**
 * DTO for creating a new organization within a company tenant
 * Implements comprehensive validation rules and Swagger documentation
 * Supports optional point configuration overrides at organization level
 */
export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Name of the organization',
    example: 'Engineering Team',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'UUID of the parent company',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID(4)
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({
    description: 'Optional point configuration overrides for the organization',
    required: false,
    type: () => PointConfig,
    example: {
      basePoints: {
        codeCheckIn: 10,
        pullRequest: 25,
        codeReview: 15,
        bugFix: 20,
        storyClosure: 30,
      },
      aiModifier: 0.75,
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PointConfig)
  pointOverrides?: PointConfig;
}