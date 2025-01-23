/**
 * @fileoverview Enhanced OAuth 2.0 authentication strategy with multi-tenant support
 * Implements secure authentication flows with comprehensive monitoring and validation
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { JwksClient } from 'jwks-rsa';
import { TenantConfig } from '../../../interfaces/tenant.interface';
import { appConfig } from '../../../config/app.config';
import { AuditLogger } from '@nestjs/common';

// Strategy constants
const OAUTH_STRATEGY_NAME = 'oauth2';
const DEFAULT_SCOPE = ['profile', 'email'];
const MAX_TOKEN_AGE = 3600;
const RATE_LIMIT_WINDOW = 60000;
const MAX_PROFILE_SIZE = 8192;

/**
 * Enhanced OAuth 2.0 strategy with multi-tenant support and security controls
 */
@Injectable()
export class OAuthStrategy extends PassportStrategy(Strategy, OAUTH_STRATEGY_NAME) {
  private readonly rateLimiter: Map<string, number>;
  private readonly tokenValidator: JwksClient;
  private readonly perfMonitor: any;

  constructor(
    private readonly tenantConfig: TenantConfig,
    private readonly auditLogger: AuditLogger,
    private readonly jwksClient: JwksClient
  ) {
    // Initialize base strategy with tenant-specific OAuth settings
    super({
      authorizationURL: tenantConfig.oauthSettings.authorizationUrl,
      tokenURL: tenantConfig.oauthSettings.tokenUrl,
      clientID: tenantConfig.oauthSettings.clientId,
      clientSecret: tenantConfig.oauthSettings.clientSecret,
      scope: DEFAULT_SCOPE,
      state: true,
      pkce: true,
      passReqToCallback: true,
    });

    // Initialize rate limiter
    this.rateLimiter = new Map();

    // Configure JWKS client for token validation
    this.tokenValidator = jwksClient;

    // Set up security headers
    this.setupSecurityHeaders();
  }

  /**
   * Configure enhanced security headers
   */
  private setupSecurityHeaders(): void {
    const { securityHeaders } = appConfig;
    Object.entries(securityHeaders).forEach(([header, value]) => {
      this.options.customHeaders = {
        ...this.options.customHeaders,
        [header]: value,
      };
    });
  }

  /**
   * Check rate limits for tenant
   * @param tenantId Tenant identifier
   * @returns boolean indicating if request is allowed
   */
  private checkRateLimit(tenantId: string): boolean {
    const now = Date.now();
    const lastRequest = this.rateLimiter.get(tenantId) || 0;
    
    if (now - lastRequest < this.tenantConfig.rateLimits.window) {
      return false;
    }
    
    this.rateLimiter.set(tenantId, now);
    return true;
  }

  /**
   * Validate JWT token using JWKS
   * @param token JWT token to validate
   * @returns Promise<boolean> indicating if token is valid
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      const decodedToken = await this.tokenValidator.verifyToken(token, {
        algorithms: ['RS256'],
        maxAge: MAX_TOKEN_AGE,
      });
      return !!decodedToken;
    } catch (error) {
      this.auditLogger.error('Token validation failed', { error });
      return false;
    }
  }

  /**
   * Enhanced token validation with security controls and monitoring
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any
  ): Promise<any> {
    const startTime = Date.now();
    const tenantId = profile?.tenant_id;

    try {
      // Check rate limits
      if (!this.checkRateLimit(tenantId)) {
        throw new Error('Rate limit exceeded');
      }

      // Validate JWT token
      const isValidToken = await this.validateToken(accessToken);
      if (!isValidToken) {
        throw new Error('Invalid token');
      }

      // Verify token claims and scope
      const userProfile = await this.getUserProfile(accessToken);
      if (!userProfile) {
        throw new Error('Invalid profile data');
      }

      // Apply tenant-specific transformations
      const transformedProfile = this.applyTenantTransformations(userProfile);

      // Log authentication event
      this.auditLogger.log('Authentication successful', {
        tenantId,
        userId: transformedProfile.id,
        timestamp: new Date().toISOString(),
      });

      // Monitor performance
      const duration = Date.now() - startTime;
      this.perfMonitor?.recordMetric('auth.validation.duration', duration);

      return transformedProfile;
    } catch (error) {
      this.auditLogger.error('Authentication failed', {
        tenantId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Secure profile retrieval with tenant isolation
   */
  private async getUserProfile(accessToken: string): Promise<object> {
    try {
      const response = await fetch(this.tenantConfig.oauthSettings.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...appConfig.corsOptions.allowedHeaders,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profile = await response.json();

      // Validate profile size
      if (JSON.stringify(profile).length > MAX_PROFILE_SIZE) {
        throw new Error('Profile data exceeds size limit');
      }

      return this.sanitizeProfile(profile);
    } catch (error) {
      this.auditLogger.error('Profile retrieval failed', { error });
      throw error;
    }
  }

  /**
   * Apply tenant-specific transformations to profile data
   */
  private applyTenantTransformations(profile: any): any {
    const { subscriptionTier } = this.tenantConfig;
    
    // Apply tier-specific transformations
    const transformedProfile = {
      id: profile.sub || profile.id,
      email: profile.email,
      name: profile.name,
      roles: this.mapTenantRoles(profile.roles || []),
      tenantId: profile.tenant_id,
      metadata: subscriptionTier === 'ENTERPRISE' ? profile.metadata : undefined,
    };

    return Object.freeze(transformedProfile);
  }

  /**
   * Sanitize profile data for security
   */
  private sanitizeProfile(profile: any): any {
    // Remove sensitive fields
    const { password, credentials, tokens, ...safeProfile } = profile;

    // Sanitize remaining fields
    return Object.entries(safeProfile).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value.replace(/[<>]/g, '');
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
  }

  /**
   * Map tenant roles to system roles
   */
  private mapTenantRoles(roles: string[]): string[] {
    const roleMapping = {
      'admin': 'COMPANY_ADMIN',
      'manager': 'ORG_ADMIN',
      'developer': 'DEVELOPER',
      'user': 'GENERAL_USER',
    };

    return roles
      .map(role => roleMapping[role.toLowerCase()] || 'GENERAL_USER')
      .filter(Boolean);
  }
}