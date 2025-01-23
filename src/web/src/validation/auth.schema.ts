/**
 * @fileoverview Zod validation schemas for authentication-related data structures.
 * Implements comprehensive security validations for login credentials, registration data,
 * and SSO configurations with strict input validation rules.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.0.0
import { Role } from '../types/auth.types';
import { isValidEmail, isStrongPassword } from '../utils/validation.utils';

/**
 * Schema for validating login credentials with enhanced security checks.
 * Enforces email format and password strength requirements.
 */
export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .refine(isValidEmail, {
      message: 'Invalid email format or domain'
    }),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine(isStrongPassword, {
      message: 'Password does not meet security requirements'
    })
}).strict();

/**
 * Schema for validating user registration data with role-based validation.
 * Includes conditional validation for organization-specific roles.
 */
export const registerSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .refine(isValidEmail, {
      message: 'Invalid email format or domain'
    }),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine(isStrongPassword, {
      message: 'Password does not meet security requirements'
    }),
  role: z.enum([
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.ORG_ADMIN,
    Role.DEVELOPER,
    Role.GENERAL_USER
  ], {
    required_error: 'Valid role is required',
    invalid_type_error: 'Invalid role specified'
  }),
  companyId: z.string()
    .uuid({ message: 'Invalid company ID format' })
    .optional(),
  organizationId: z.string()
    .uuid({ message: 'Invalid organization ID format' })
    .optional()
}).strict()
  .refine((data) => !(data.role === Role.ORG_ADMIN && !data.organizationId), {
    message: 'Organization ID is required for Org Admin role'
  })
  .refine((data) => !(data.role === Role.COMPANY_ADMIN && !data.companyId), {
    message: 'Company ID is required for Company Admin role'
  });

/**
 * Schema for validating SSO provider configuration with protocol-specific requirements.
 * Supports SAML, OAuth2, and OIDC protocols with appropriate field validation.
 */
export const ssoConfigSchema = z.object({
  name: z.string()
    .min(1, { message: 'Provider name is required' })
    .max(100, { message: 'Provider name too long' }),
  url: z.string()
    .url({ message: 'Invalid SSO endpoint URL' }),
  protocol: z.enum(['SAML', 'OAuth2', 'OIDC'], {
    required_error: 'SSO protocol is required'
  }),
  icon: z.string()
    .min(1, { message: 'Provider icon is required' })
    .url({ message: 'Invalid icon URL' }),
  isEnabled: z.boolean(),
  clientId: z.string()
    .min(1, { message: 'Client ID is required' })
    .optional(),
  clientSecret: z.string()
    .min(1, { message: 'Client secret is required' })
    .optional(),
  metadataUrl: z.string()
    .url({ message: 'Invalid metadata URL' })
    .optional(),
  callbackUrl: z.string()
    .url({ message: 'Invalid callback URL' })
    .optional(),
  domains: z.array(
    z.string()
      .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9].[a-zA-Z]{2,}$/,
        { message: 'Invalid domain format' }
      )
  ),
  attributes: z.record(z.string(), z.string())
    .optional()
}).strict()
  .refine((data) => {
    if (data.protocol === 'OAuth2' || data.protocol === 'OIDC') {
      return !!data.clientId && !!data.clientSecret && !!data.callbackUrl;
    }
    return true;
  }, {
    message: 'OAuth2/OIDC requires clientId, clientSecret, and callbackUrl'
  })
  .refine((data) => {
    if (data.protocol === 'SAML') {
      return !!data.metadataUrl;
    }
    return true;
  }, {
    message: 'SAML requires metadataUrl'
  });

/**
 * Validates login form data against the login schema with detailed error reporting.
 * @param data The login data to validate
 * @returns Validation result with any errors
 */
export const validateLoginData = (data: unknown): {
  success: boolean;
  errors?: { field: string; message: string }[];
} => {
  try {
    loginSchema.parse(data);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validation failed' }]
    };
  }
};

/**
 * Validates registration data with role-based validation logic.
 * @param data The registration data to validate
 * @returns Validation result with any errors
 */
export const validateRegistrationData = (data: unknown): {
  success: boolean;
  errors?: { field: string; message: string }[];
} => {
  try {
    registerSchema.parse(data);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validation failed' }]
    };
  }
};

/**
 * Validates SSO configuration with protocol-specific requirements.
 * @param config The SSO configuration to validate
 * @returns Validation result with any errors
 */
export const validateSSOConfig = (config: unknown): {
  success: boolean;
  errors?: { field: string; message: string }[];
} => {
  try {
    ssoConfigSchema.parse(config);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validation failed' }]
    };
  }
};