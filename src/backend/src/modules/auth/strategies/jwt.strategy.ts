/**
 * @fileoverview JWT authentication strategy implementation for CodeQuest platform
 * Implements secure token validation with tenant context verification for multi-tenant architecture
 * @version 1.0.0
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { TenantContext } from '../../../interfaces/tenant.interface';
import { ROLES, isValidRole } from '../../../constants/roles.constants';

/**
 * Interface for JWT payload structure with strict typing
 */
interface JwtPayload {
  sub: string;
  email: string;
  role: ROLES;
  tenant: TenantContext;
  iat: number;
  exp: number;
  iss: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly jwtSecret: string;
  private readonly tokenExpiration: number;
  private readonly tokenIssuer: string;

  constructor() {
    // Validate required environment variables
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not defined');
    }
    if (!process.env.TOKEN_ISSUER) {
      throw new Error('TOKEN_ISSUER environment variable is not defined');
    }

    // Initialize class properties
    this.jwtSecret = process.env.JWT_SECRET;
    this.tokenExpiration = 3600; // 1 hour in seconds
    this.tokenIssuer = process.env.TOKEN_ISSUER;

    // Configure JWT strategy with secure options
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: this.jwtSecret,
      ignoreExpiration: false,
      issuer: this.tokenIssuer,
      algorithms: ['HS256'],
      passReqToCallback: false,
    });
  }

  /**
   * Validates JWT payload and tenant context with comprehensive security checks
   * @param payload - JWT payload to validate
   * @returns Promise resolving to validated user data with tenant context
   * @throws UnauthorizedException for invalid tokens or tenant context
   */
  async validate(payload: JwtPayload): Promise<any> {
    try {
      // Validate payload structure
      if (!payload || typeof payload !== 'object') {
        throw new UnauthorizedException('Invalid token structure');
      }

      // Validate required user fields
      if (!payload.sub || !payload.email || !payload.role) {
        throw new UnauthorizedException('Missing required user fields in token');
      }

      // Validate role
      if (!isValidRole(payload.role)) {
        throw new UnauthorizedException('Invalid role in token');
      }

      // Validate tenant context
      if (!payload.tenant || typeof payload.tenant !== 'object') {
        throw new UnauthorizedException('Missing tenant context in token');
      }

      // Validate required tenant fields
      const { tenantId, companyId, organizationId } = payload.tenant;
      if (!tenantId || !companyId) {
        throw new UnauthorizedException('Invalid tenant context structure');
      }

      // Validate token timestamps
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp <= currentTime) {
        throw new UnauthorizedException('Token has expired');
      }
      if (payload.iat > currentTime) {
        throw new UnauthorizedException('Token issued in the future');
      }

      // Validate token issuer
      if (payload.iss !== this.tokenIssuer) {
        throw new UnauthorizedException('Invalid token issuer');
      }

      // Return validated user data with tenant context
      return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        tenant: {
          tenantId: tenantId,
          companyId: companyId,
          organizationId: organizationId || null,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }
}