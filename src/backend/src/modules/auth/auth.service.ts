/**
 * @fileoverview Service implementing comprehensive authentication logic with enhanced security features
 * including SSO integration, token management, and advanced security controls.
 * @version 1.0.0
 */

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'; // ^10.0.0
import { JwtService } from '@nestjs/jwt'; // ^10.0.0
import { compare } from 'bcrypt'; // ^5.0.0
import { UserRepository } from '../../repositories/user.repository';
import { LoginDto } from '../../dto/auth/login.dto';
import { ROLES } from '../../constants/roles.constants';
import { TokenBlacklist } from './token-blacklist.service';
import { RateLimiter } from './rate-limiter.service';

// Token configuration constants
const JWT_ACCESS_TOKEN_EXPIRES_IN = 3600; // 1 hour
const JWT_REFRESH_TOKEN_EXPIRES_IN = 604800; // 7 days
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 300000; // 5 minutes

/**
 * Service implementing comprehensive authentication logic with enhanced security features
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklist: TokenBlacklist,
    private readonly rateLimiter: RateLimiter
  ) {}

  /**
   * Validates user credentials with enhanced security checks
   * @param loginDto - Login credentials DTO
   * @returns Promise resolving to validated user data or null
   * @throws UnauthorizedException for invalid credentials
   * @throws BadRequestException for rate limit exceeded
   */
  async validateUser(loginDto: LoginDto): Promise<any> {
    // Check rate limiting
    const rateLimitKey = `auth_${loginDto.email.toLowerCase()}`;
    if (await this.rateLimiter.isLimited(rateLimitKey, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS)) {
      throw new BadRequestException('Too many login attempts. Please try again later.');
    }

    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      await this.rateLimiter.increment(rateLimitKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      await this.rateLimiter.increment(rateLimitKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login timestamp
    await this.userRepository.updateLastLogin(user.id);

    // Return user data without sensitive fields
    const { password, ssoData, ...result } = user;
    return result;
  }

  /**
   * Validates or creates user from SSO data with enhanced security
   * @param ssoProfile - SSO profile data
   * @returns Promise resolving to user data with tenant context
   * @throws BadRequestException for invalid SSO data
   */
  async validateSSOUser(ssoProfile: any): Promise<any> {
    if (!ssoProfile?.email || !ssoProfile?.provider || !ssoProfile?.providerId) {
      throw new BadRequestException('Invalid SSO profile data');
    }

    const email = ssoProfile.email.toLowerCase();
    let user = await this.userRepository.findByEmail(email);

    if (user) {
      // Update existing user's SSO data
      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }
      await this.userRepository.updateSSOData(user.id, {
        provider: ssoProfile.provider,
        providerId: ssoProfile.providerId,
        accessToken: ssoProfile.accessToken,
        refreshToken: ssoProfile.refreshToken,
        profile: ssoProfile.profile,
        metadata: {
          lastLogin: new Date().toISOString(),
          lastProvider: ssoProfile.provider
        }
      });
    } else {
      // Create new user with SSO data
      user = await this.userRepository.createUser(
        email,
        ROLES.GENERAL_USER,
        {
          provider: ssoProfile.provider,
          providerId: ssoProfile.providerId,
          accessToken: ssoProfile.accessToken,
          refreshToken: ssoProfile.refreshToken,
          profile: ssoProfile.profile,
          metadata: {
            createdAt: new Date().toISOString(),
            provider: ssoProfile.provider
          }
        }
      );
    }

    const { password, ssoData, ...result } = user;
    return result;
  }

  /**
   * Generates secure JWT token pair with refresh capability
   * @param userData - User data for token payload
   * @returns Promise resolving to token pair
   */
  async generateToken(userData: any): Promise<{ access_token: string; refresh_token: string }> {
    const payload = {
      sub: userData.id,
      email: userData.email,
      role: userData.role,
      permissions: userData.permissions,
      tenant: userData.tenant
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN,
      secret: process.env.JWT_ACCESS_SECRET
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, tokenType: 'refresh' },
      {
        expiresIn: JWT_REFRESH_TOKEN_EXPIRES_IN,
        secret: process.env.JWT_REFRESH_SECRET
      }
    );

    // Store refresh token metadata
    await this.tokenBlacklist.storeToken(refreshToken, {
      userId: userData.id,
      expiresIn: JWT_REFRESH_TOKEN_EXPIRES_IN,
      createdAt: new Date().toISOString()
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken
    };
  }

  /**
   * Validates and refreshes access token using refresh token
   * @param refreshToken - Refresh token to validate
   * @returns Promise resolving to new access token
   * @throws UnauthorizedException for invalid or blacklisted refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      // Verify refresh token is valid and not blacklisted
      if (await this.tokenBlacklist.isBlacklisted(refreshToken)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Generate new access token
      const accessToken = this.jwtService.sign(
        {
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
          permissions: payload.permissions,
          tenant: payload.tenant
        },
        {
          expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN,
          secret: process.env.JWT_ACCESS_SECRET
        }
      );

      return { access_token: accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Invalidates all tokens for a user
   * @param userId - User ID to invalidate tokens for
   * @returns Promise resolving when tokens are invalidated
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    await this.tokenBlacklist.invalidateUserTokens(userId);
  }
}