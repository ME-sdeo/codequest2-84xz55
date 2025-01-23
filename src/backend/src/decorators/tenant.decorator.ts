/**
 * @fileoverview Tenant decorator for secure multi-tenant context injection
 * Implements strict tenant context validation and security checks for CodeQuest's multi-tenant architecture
 * @version 1.0.0
 */

import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TenantContext } from '../interfaces/tenant.interface';

/**
 * Error messages for tenant context validation
 */
const TENANT_CONTEXT_MISSING = 'Tenant context is missing or invalid in request';
const TENANT_CONTEXT_MALFORMED = 'Tenant context contains malformed or invalid identifiers';

/**
 * Validates UUID format for tenant identifiers
 * @param id - ID string to validate
 * @returns boolean indicating if ID is valid UUID format
 */
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Validates tenant context object structure and field types
 * @param context - Tenant context object to validate
 * @returns boolean indicating if context is valid
 */
const isValidTenantContext = (context: any): context is TenantContext => {
  if (!context || typeof context !== 'object') return false;

  const { tenantId, companyId, organizationId } = context;

  // Check all required fields are present and are strings
  if (typeof tenantId !== 'string' || 
      typeof companyId !== 'string' || 
      typeof organizationId !== 'string') {
    return false;
  }

  // Validate UUID format for all identifiers
  return isValidUUID(tenantId) && 
         isValidUUID(companyId) && 
         isValidUUID(organizationId);
};

/**
 * Factory function that creates and validates tenant context
 * Implements strict security checks and validation
 * @param _data - Unused parameter required by NestJS decorator factory
 * @param context - Execution context from NestJS
 * @returns Validated tenant context
 * @throws UnauthorizedException if tenant context is missing or invalid
 */
const getTenantContext = (_data: unknown, context: ExecutionContext): TenantContext => {
  const request = context.switchToHttp().getRequest();
  const tenantContext = request.tenantContext;

  // Check if tenant context exists
  if (!tenantContext) {
    throw new UnauthorizedException(TENANT_CONTEXT_MISSING);
  }

  // Validate tenant context structure and field types
  if (!isValidTenantContext(tenantContext)) {
    throw new UnauthorizedException(TENANT_CONTEXT_MALFORMED);
  }

  return tenantContext;
};

/**
 * Tenant decorator for injecting validated tenant context
 * Usage: @Tenant() tenantContext: TenantContext
 */
export const Tenant = createParamDecorator(getTenantContext);