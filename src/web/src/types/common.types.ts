/**
 * @fileoverview Core TypeScript type definitions for the CodeQuest frontend application.
 * Provides foundational interfaces, enums, and utility types for consistent data structures
 * and type safety across the application.
 * @version 1.0.0
 */

/**
 * Base interface for all entity types with common fields.
 * Enforces strict typing for ID and timestamp fields.
 */
export interface BaseEntity {
  /** Unique identifier for the entity */
  id: string;
  /** Timestamp when the entity was created */
  createdAt: Date;
  /** Timestamp when the entity was last updated */
  updatedAt: Date;
}

/**
 * Base interface for all tenant-scoped entities.
 * Ensures proper multi-tenant data isolation through required company and organization IDs.
 */
export interface TenantEntity {
  /** Unique identifier for the company */
  companyId: string;
  /** Unique identifier for the organization within the company */
  organizationId: string;
}

/**
 * Comprehensive enumeration of user roles for access control.
 * Defines the hierarchy of permissions across the application.
 */
export enum Role {
  /** Highest level of access with system-wide permissions */
  SUPER_ADMIN = 'SUPER_ADMIN',
  /** Company-level administrative access */
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  /** Organization-level administrative access */
  ORG_ADMIN = 'ORG_ADMIN',
  /** Standard developer access with point-earning capabilities */
  DEVELOPER = 'DEVELOPER',
  /** Basic access for viewing and participating */
  GENERAL_USER = 'GENERAL_USER'
}

/**
 * Generic interface for paginated API responses.
 * Ensures consistent pagination structure across all list endpoints.
 * @template T The type of data being paginated
 */
export interface PaginatedResponse<T> {
  /** Array of paginated items */
  data: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
}

/**
 * Generic interface for API responses.
 * Provides consistent structure for all API responses with proper error handling.
 * @template T The type of data being returned
 */
export interface ApiResponse<T> {
  /** Indicates if the API call was successful */
  success: boolean;
  /** Response payload */
  data: T;
  /** Optional success message */
  message?: string;
  /** Optional error message */
  error?: string;
}

/**
 * Utility type for null-possible values.
 * Enforces strict null checking in TypeScript.
 * @template T The base type that can be null
 */
export type Nullable<T> = T | null;

/**
 * Utility type for undefined-possible values.
 * Enforces strict undefined checking in TypeScript.
 * @template T The base type that can be undefined
 */
export type Optional<T> = T | undefined;