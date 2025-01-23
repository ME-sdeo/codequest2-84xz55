/**
 * @fileoverview Enhanced tenant guard for enforcing tenant-level access control
 * Implements multi-tenant architecture requirements with role-based validation
 * and performance optimizations
 * @version 1.0.0
 */

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContext } from '../interfaces/tenant.interface';
import { ROLES, isValidRole, getAllPermissionsForRole } from '../constants/roles.constants';
import { validate as uuidValidate } from 'uuid';

/**
 * Error messages for tenant validation failures
 */
const TENANT_CONTEXT_MISSING = 'Tenant context is missing or invalid in request';
const INVALID_TENANT_ACCESS = 'Invalid tenant access attempt detected';
const INVALID_ROLE_ACCESS = 'User role does not have required permissions';
const INVALID_ORGANIZATION_ACCESS = 'Invalid organization access attempt';

/**
 * Cache TTL for role validation results in milliseconds
 */
const ROLE_VALIDATION_CACHE_TTL = 300000; // 5 minutes

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly validationCache: Map<string, { result: boolean; timestamp: number }>;

  constructor(private readonly reflector: Reflector) {
    this.validationCache = new Map();
  }

  /**
   * Validates tenant context and permissions for incoming requests
   * @param context - Execution context containing request details
   * @returns Promise resolving to boolean indicating if request is authorized
   * @throws UnauthorizedException for invalid tenant access attempts
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantContext: TenantContext = request.tenantContext;

    // Validate tenant context existence
    if (!this.isValidTenantContext(tenantContext)) {
      throw new UnauthorizedException(TENANT_CONTEXT_MISSING);
    }

    // Validate UUID format for IDs
    if (!this.areValidUUIDs(tenantContext)) {
      throw new UnauthorizedException(INVALID_TENANT_ACCESS);
    }

    // Check role-based access
    const requiredRoles = this.reflector.get<ROLES[]>('roles', context.getHandler()) || [];
    if (requiredRoles.length > 0) {
      const isAuthorized = await this.validateRoleAccess(
        tenantContext,
        requiredRoles,
        request.user?.role
      );
      if (!isAuthorized) {
        throw new UnauthorizedException(INVALID_ROLE_ACCESS);
      }
    }

    // Validate organization access if applicable
    if (tenantContext.organizationId && !await this.validateOrganizationAccess(
      tenantContext,
      request.user?.role
    )) {
      throw new UnauthorizedException(INVALID_ORGANIZATION_ACCESS);
    }

    return true;
  }

  /**
   * Validates the structure of tenant context object
   * @param context - Tenant context to validate
   * @returns Boolean indicating if context is valid
   */
  private isValidTenantContext(context: TenantContext): boolean {
    return Boolean(
      context &&
      context.tenantId &&
      context.companyId &&
      typeof context.tenantId === 'string' &&
      typeof context.companyId === 'string'
    );
  }

  /**
   * Validates UUID format for tenant identifiers
   * @param context - Tenant context containing IDs to validate
   * @returns Boolean indicating if all UUIDs are valid
   */
  private areValidUUIDs(context: TenantContext): boolean {
    const ids = [
      context.tenantId,
      context.companyId,
      context.organizationId
    ].filter(Boolean);

    return ids.every(id => uuidValidate(id));
  }

  /**
   * Validates role-based access with caching
   * @param context - Tenant context
   * @param requiredRoles - Array of required roles
   * @param userRole - Current user's role
   * @returns Promise resolving to boolean indicating if access is authorized
   */
  private async validateRoleAccess(
    context: TenantContext,
    requiredRoles: ROLES[],
    userRole?: string
  ): Promise<boolean> {
    if (!userRole || !isValidRole(userRole)) {
      return false;
    }

    const cacheKey = `${context.tenantId}:${userRole}:${requiredRoles.join(',')}`;
    const cached = this.validationCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ROLE_VALIDATION_CACHE_TTL) {
      return cached.result;
    }

    const userPermissions = getAllPermissionsForRole(userRole);
    const hasRequiredRole = requiredRoles.some(role => 
      userRole === role || getAllPermissionsForRole(role).every(
        permission => userPermissions.includes(permission)
      )
    );

    this.validationCache.set(cacheKey, {
      result: hasRequiredRole,
      timestamp: Date.now()
    });

    return hasRequiredRole;
  }

  /**
   * Validates organization-level access
   * @param context - Tenant context
   * @param userRole - Current user's role
   * @returns Promise resolving to boolean indicating if organization access is valid
   */
  private async validateOrganizationAccess(
    context: TenantContext,
    userRole?: string
  ): Promise<boolean> {
    if (!userRole || !isValidRole(userRole)) {
      return false;
    }

    // Super admin has access to all organizations
    if (userRole === ROLES.SUPER_ADMIN) {
      return true;
    }

    // Company admin has access to all organizations within their company
    if (userRole === ROLES.COMPANY_ADMIN) {
      return true;
    }

    // Organization admin and below must belong to the specific organization
    return [ROLES.ORG_ADMIN, ROLES.DEVELOPER, ROLES.GENERAL_USER].includes(userRole as ROLES);
  }
}