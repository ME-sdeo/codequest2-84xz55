/**
 * @fileoverview Enhanced NestJS guard implementation for JWT-based authentication with tenant isolation,
 * token blacklisting, and detailed security logging.
 * @version 1.0.0
 */

import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  UnauthorizedException,
  Logger 
} from '@nestjs/common'; // ^10.0.0
import { AuthService } from '../modules/auth/auth.service';

/**
 * Enhanced authentication guard that validates JWT/SSO tokens and implements tenant isolation
 * with comprehensive security logging and token blacklist checking.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger('AuthGuard');

  constructor(private readonly authService: AuthService) {}

  /**
   * Validates tokens and determines route access with enhanced security checks
   * @param context - NestJS execution context
   * @returns Promise resolving to boolean indicating if access is allowed
   * @throws UnauthorizedException for invalid or expired tokens
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers.authorization;

      // Validate authorization header format
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        this.logAuthFailure(request, 'Missing or invalid authorization header');
        throw new UnauthorizedException('Invalid authorization header');
      }

      // Extract and validate token
      const token = authHeader.split(' ')[1];
      if (!token) {
        this.logAuthFailure(request, 'Empty token provided');
        throw new UnauthorizedException('Token not provided');
      }

      // Check token blacklist
      const isBlacklisted = await this.authService.checkTokenBlacklist(token);
      if (isBlacklisted) {
        this.logAuthFailure(request, 'Token is blacklisted');
        throw new UnauthorizedException('Token has been revoked');
      }

      // Determine token type and validate accordingly
      if (this.isSSO(token)) {
        const userData = await this.authService.validateSSOUser(token);
        if (!userData) {
          this.logAuthFailure(request, 'Invalid SSO token');
          throw new UnauthorizedException('Invalid SSO token');
        }
        request.user = userData;
      } else {
        // Validate JWT token and extract tenant context
        const decodedToken = await this.validateJWT(token);
        if (!decodedToken) {
          this.logAuthFailure(request, 'Invalid JWT token');
          throw new UnauthorizedException('Invalid token');
        }
        request.user = decodedToken;
        request.tenantId = decodedToken.tenant;
      }

      // Log successful authentication
      this.logAuthSuccess(request);
      return true;

    } catch (error) {
      // Log authentication failure with detailed error
      this.logAuthFailure(context.switchToHttp().getRequest(), error.message);
      throw new UnauthorizedException(error.message);
    }
  }

  /**
   * Validates JWT token and extracts payload
   * @param token - JWT token to validate
   * @returns Promise resolving to decoded token payload or null
   * @private
   */
  private async validateJWT(token: string): Promise<any> {
    try {
      // Token validation is handled by AuthService
      const decodedToken = await this.authService.validateToken(token);
      if (!decodedToken?.sub || !decodedToken?.tenant) {
        return null;
      }
      return decodedToken;
    } catch {
      return null;
    }
  }

  /**
   * Determines if token is an SSO token based on format
   * @param token - Token to check
   * @returns Boolean indicating if token is SSO format
   * @private
   */
  private isSSO(token: string): boolean {
    // Check for SSO-specific token format (implementation specific)
    return token.startsWith('SSO_');
  }

  /**
   * Logs successful authentication attempts with security context
   * @param request - HTTP request object
   * @private
   */
  private logAuthSuccess(request: any): void {
    this.logger.log({
      event: 'AUTH_SUCCESS',
      userId: request.user?.sub,
      tenantId: request.tenantId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      path: request.path,
      method: request.method,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Logs failed authentication attempts with security context
   * @param request - HTTP request object
   * @param reason - Failure reason
   * @private
   */
  private logAuthFailure(request: any, reason: string): void {
    this.logger.warn({
      event: 'AUTH_FAILURE',
      reason,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      path: request.path,
      method: request.method,
      timestamp: new Date().toISOString()
    });
  }
}