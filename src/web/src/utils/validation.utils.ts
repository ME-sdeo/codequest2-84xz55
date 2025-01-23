/**
 * @fileoverview Utility functions for input validation and data sanitization across the frontend application.
 * Provides reusable validation logic for forms, API requests, and data processing with enhanced schema validation
 * and security features using Zod and DOMPurify.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.0.0
import DOMPurify from 'dompurify'; // v3.0.1
import { ActivityType } from '../types/activity.types';
import { BASE_POINTS, AI_POINT_MODIFIER } from '../constants/activity.constants';

// Regular expressions for validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Constants
const PASSWORD_MIN_LENGTH = 8;
const HTML_ALLOWED_TAGS = ['p', 'span', 'b', 'i', 'em', 'strong'];

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  code: string;
  details: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, ValidationError);
  }
}

/**
 * Zod schema for email validation
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .regex(EMAIL_REGEX, 'Email format does not match required pattern')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must not exceed 254 characters');

/**
 * Zod schema for password validation
 */
export const passwordSchema = z.string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(PASSWORD_REGEX, 'Password must contain uppercase, lowercase, number, and special character');

/**
 * Zod schema for activity validation
 */
export const activitySchema = z.object({
  type: z.nativeEnum(ActivityType),
  isAiGenerated: z.boolean(),
  points: z.number().min(0),
  teamMemberId: z.string().uuid(),
  metadata: z.object({
    adoId: z.string(),
    repository: z.string(),
    branch: z.string().optional(),
    url: z.string().url(),
    title: z.string().min(1),
    description: z.string().optional()
  })
});

/**
 * Validates email format
 * @param email - Email string to validate
 * @returns Boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  try {
    emailSchema.parse(email);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validates password strength
 * @param password - Password string to validate
 * @returns Boolean indicating if password meets strength requirements
 */
export const isStrongPassword = (password: string): boolean => {
  try {
    passwordSchema.parse(password);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validates activity points calculation against business rules
 * @param activityType - Type of activity
 * @param isAiGenerated - Whether activity was AI generated
 * @param points - Points to validate
 * @returns Boolean indicating if points calculation is valid
 * @throws ValidationError if points calculation is invalid
 */
export const validateActivityPoints = (
  activityType: ActivityType,
  isAiGenerated: boolean,
  points: number
): boolean => {
  const basePoints = BASE_POINTS[activityType];
  const expectedPoints = isAiGenerated 
    ? basePoints * AI_POINT_MODIFIER.MULTIPLIER 
    : basePoints;

  if (points !== expectedPoints) {
    throw new ValidationError(
      'Invalid points calculation',
      'INVALID_POINTS',
      {
        activityType,
        isAiGenerated,
        expectedPoints,
        actualPoints: points
      }
    );
  }

  return true;
};

/**
 * Interface for sanitization options
 */
interface SanitizeOptions {
  allowedTags?: string[];
  stripAllTags?: boolean;
}

/**
 * Sanitizes user input to prevent XSS and injection attacks
 * @param input - String to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export const sanitizeInput = (
  input: string,
  options: SanitizeOptions = {}
): string => {
  const {
    allowedTags = HTML_ALLOWED_TAGS,
    stripAllTags = false
  } = options;

  // Configure DOMPurify options
  const config = {
    ALLOWED_TAGS: stripAllTags ? [] : allowedTags,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: true
  };

  // Sanitize the input
  return DOMPurify.sanitize(input, config);
};

// Export schemas object for reuse
export const schemas = {
  emailSchema,
  passwordSchema,
  activitySchema
};