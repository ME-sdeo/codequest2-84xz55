/**
 * @fileoverview Data Transfer Object for validating company update requests
 * Implements strict validation rules for company updates with comprehensive security measures
 * @version 1.0.0
 */

import { IsString, IsOptional, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TenantConfig, SubscriptionTier, PointConfig } from '../../interfaces/tenant.interface';

/**
 * DTO for validating company update requests
 * Implements validation rules for multi-tenant architecture and points administration
 * Supports different system tiers from small to enterprise scale
 */
export class UpdateCompanyDto implements Partial<TenantConfig> {
  /**
   * Optional company name field
   * Must be a valid string when provided
   */
  @IsOptional()
  @IsString({
    message: 'Company name must be a valid string'
  })
  name?: string;

  /**
   * Optional subscription tier field
   * Must be a valid enum value from SubscriptionTier when provided
   * Supports SMALL, MEDIUM, and ENTERPRISE tiers
   */
  @IsOptional()
  @IsEnum(SubscriptionTier, {
    message: 'Subscription tier must be one of: SMALL, MEDIUM, ENTERPRISE'
  })
  subscriptionTier?: SubscriptionTier;

  /**
   * Optional point configuration field
   * Must be a valid PointConfig object when provided
   * Supports nested validation of point settings and AI modifiers
   */
  @IsOptional()
  @IsObject({
    message: 'Point configuration must be a valid object'
  })
  @ValidateNested({
    message: 'Invalid point configuration structure'
  })
  @Type(() => Object)
  pointConfig?: PointConfig;
}