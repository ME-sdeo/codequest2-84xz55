/**
 * @fileoverview Custom parameter decorator for extracting authenticated user data from request context
 * Provides type-safe access with comprehensive validation and error handling
 * @version 1.0.0
 */

import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common'; // ^10.0.0
import { UserEntity } from '../entities/user.entity';
import { isValidRole } from '../constants/roles.constants';

/**
 * Factory function that extracts and validates user data from request context
 * Implements comprehensive validation and error handling
 * 
 * @param context - NestJS execution context containing the request
 * @throws UnauthorizedException if user data is invalid or missing
 * @returns Validated UserEntity object
 */
const getCurrentUser = (context: ExecutionContext): UserEntity => {
  try {
    // Extract request object from context
    const request = context.switchToHttp().getRequest();

    // Validate request and user existence
    if (!request || !request.user) {
      throw new UnauthorizedException('User context not found in request');
    }

    const user = request.user;

    // Validate required user properties exist
    if (!user.id || !user.email || !user.role) {
      throw new UnauthorizedException('Invalid user data: missing required properties');
    }

    // Validate property types
    if (
      typeof user.id !== 'string' ||
      typeof user.email !== 'string' ||
      typeof user.role !== 'string'
    ) {
      throw new UnauthorizedException('Invalid user data: incorrect property types');
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(user.email)) {
      throw new UnauthorizedException('Invalid user data: malformed email');
    }

    // Validate role is valid
    if (!isValidRole(user.role)) {
      throw new UnauthorizedException('Invalid user data: unrecognized role');
    }

    // Validate user is active
    if (user.isActive === false) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Return validated user object with proper typing
    return user as UserEntity;

  } catch (error) {
    // Ensure all errors are wrapped as UnauthorizedException with clear messages
    if (error instanceof UnauthorizedException) {
      throw error;
    }
    throw new UnauthorizedException(
      `Failed to extract user context: ${error.message || 'Unknown error'}`
    );
  }
};

/**
 * Parameter decorator for extracting authenticated user data from request context
 * Provides type-safe access with comprehensive validation
 * 
 * Usage:
 * @Controller('example')
 * class ExampleController {
 *   @Get()
 *   example(@CurrentUser() user: UserEntity) {
 *     // Type-safe access to validated user data
 *     console.log(user.email);
 *   }
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserEntity => getCurrentUser(ctx)
);