/**
 * @fileoverview Enhanced NestJS guard implementation for role-based access control (RBAC)
 * Provides comprehensive security checks, role inheritance validation, and error handling
 * @version 1.0.0
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES, ROLE_HIERARCHY } from '../constants/roles.constants';

/**
 * Enhanced guard implementation for role-based access control with comprehensive security features
 * Validates user roles against required roles with inheritance support and detailed error handling
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Creates an instance of RolesGuard with dependency injection
   * @param reflector - NestJS Reflector service for metadata access
   * @throws Error if reflector dependency is not provided
   */
  constructor(private readonly reflector: Reflector) {
    if (!reflector) {
      throw new Error('Reflector dependency is required for RolesGuard');
    }
  }

  /**
   * Primary guard method that validates user roles against required roles
   * Implements comprehensive security checks and inheritance validation
   * @param context - ExecutionContext containing request and handler information
   * @returns boolean indicating if access is granted
   * @throws Error for invalid context or missing user data
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Extract required roles from route metadata with type safety
      const requiredRoles = this.reflector.get<ROLES[]>('roles', context.getHandler());

      // If no roles are required, allow access by default
      if (!requiredRoles || requiredRoles.length === 0) {
        return true;
      }

      // Get request object from context with type checking
      const request = context.switchToHttp().getRequest();
      if (!request) {
        throw new Error('Invalid execution context - HTTP request not found');
      }

      // Extract user from request with comprehensive validation
      const user = request.user;
      if (!user || !user.role) {
        throw new Error('User or user role not found in request');
      }

      // Validate user role is a valid ROLES enum value
      if (!Object.values(ROLES).includes(user.role)) {
        throw new Error(`Invalid user role: ${user.role}`);
      }

      // Check each required role with inheritance validation
      const hasValidRole = requiredRoles.some(requiredRole => 
        this.hasRole(user.role, requiredRole)
      );

      // Log access attempt for security auditing
      console.log({
        timestamp: new Date().toISOString(),
        user: user.id,
        userRole: user.role,
        requiredRoles,
        access: hasValidRole ? 'granted' : 'denied'
      });

      return hasValidRole;
    } catch (error) {
      // Log error and deny access by default for security
      console.error('RolesGuard error:', error);
      return false;
    }
  }

  /**
   * Helper method to check if a user role matches or inherits a required role
   * Implements strict type checking and comprehensive validation
   * @param userRole - Current user's role
   * @param requiredRole - Role required for access
   * @returns boolean indicating if user has required role or inherits it
   * @throws Error for invalid role parameters
   */
  private hasRole(userRole: string, requiredRole: ROLES): boolean {
    try {
      // Validate input parameters
      if (!userRole || !requiredRole) {
        throw new Error('Invalid role parameters');
      }

      // Direct role match check with type safety
      if (userRole === requiredRole) {
        return true;
      }

      // Get inheritance hierarchy for user role
      const roleHierarchy = ROLE_HIERARCHY[userRole as ROLES];
      if (!roleHierarchy) {
        throw new Error(`Invalid role hierarchy for: ${userRole}`);
      }

      // Check if user role inherits the required role
      return roleHierarchy.includes(requiredRole);
    } catch (error) {
      // Log error and deny access by default
      console.error('Role validation error:', error);
      return false;
    }
  }
}