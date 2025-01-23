/**
 * @fileoverview Data Transfer Object for company creation in the multi-tenant architecture
 * Implements strict validation rules and type safety for company tenant creation
 * @version 1.0.0
 */

import { IsString, IsNotEmpty, IsEnum, ValidateNested, Length, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionTier, PointConfig } from '../../interfaces/tenant.interface';

/**
 * Base points validation class for company point configuration
 */
class BasePointsDto {
  @IsNotEmpty()
  @Type(() => Number)
  readonly codeCheckIn: number;

  @IsNotEmpty()
  @Type(() => Number)
  readonly pullRequest: number;

  @IsNotEmpty()
  @Type(() => Number)
  readonly codeReview: number;

  @IsNotEmpty()
  @Type(() => Number)
  readonly bugFix: number;

  @IsNotEmpty()
  @Type(() => Number)
  readonly storyClosure: number;
}

/**
 * Point configuration validation class with nested validation
 */
class PointConfigDto implements PointConfig {
  @ValidateNested()
  @Type(() => BasePointsDto)
  readonly basePoints: BasePointsDto;

  @IsNotEmpty()
  @Type(() => Number)
  readonly aiModifier: number;

  @ValidateNested()
  @Type(() => BasePointsDto)
  readonly orgOverrides: Record<string, BasePointsDto>;
}

/**
 * Data Transfer Object for company creation with comprehensive validation
 * Implements multi-tenant architecture requirements and strict validation rules
 */
export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100, { message: 'Company name must be between 3 and 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message: 'Company name can only contain alphanumeric characters, spaces, hyphens, and underscores'
  })
  readonly name: string;

  @IsNotEmpty()
  @IsEnum(SubscriptionTier, {
    message: 'Subscription tier must be one of: SMALL, MEDIUM, ENTERPRISE'
  })
  readonly subscriptionTier: SubscriptionTier;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PointConfigDto)
  readonly pointConfig: PointConfigDto;
}