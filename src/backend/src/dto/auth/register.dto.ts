/**
 * @fileoverview Data Transfer Object for user registration in the CodeQuest platform
 * Implements comprehensive validation for registration data with enterprise-grade security checks
 * @version 1.0.0
 */

import { IsEmail, IsNotEmpty, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ROLES } from '../../constants/roles.constants';

/**
 * Allowed roles for initial user registration
 * Limited to Company Admin and Developer roles for security
 */
const REGISTRATION_ROLES = [ROLES.COMPANY_ADMIN, ROLES.DEVELOPER] as const;

/**
 * Data Transfer Object for validating user registration requests
 * Implements strict validation for email format, role authorization, and SSO data
 */
export class RegisterDto {
  /**
   * User's email address
   * Must be a valid email format according to RFC 5322
   * Required field that cannot be empty
   */
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  /**
   * User's role in the system
   * Must be one of the allowed registration roles
   * Required field that cannot be empty
   */
  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(REGISTRATION_ROLES, { 
    message: 'Role must be either COMPANY_ADMIN or DEVELOPER'
  })
  role: ROLES;

  /**
   * Optional SSO provider data
   * Required when registering through SSO
   * Must be a valid object when provided
   */
  @IsOptional()
  @IsObject({ message: 'SSO data must be a valid object' })
  ssoData?: Record<string, any>;
}