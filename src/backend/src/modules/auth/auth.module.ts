/**
 * @fileoverview Authentication module configuring comprehensive enterprise-grade authentication
 * with JWT, OAuth2, SAML, and OpenID Connect support for the CodeQuest platform.
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // ^10.0.0
import { PassportModule } from '@nestjs/passport'; // ^10.0.0
import { JwtModule } from '@nestjs/jwt'; // ^10.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // ^5.0.0
import { CacheModule } from '@nestjs/cache-manager'; // ^2.0.0

// Internal imports
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OAuthStrategy } from './strategies/oauth.strategy';
import { SamlStrategy } from './strategies/saml.strategy';

// Configuration constants
const JWT_ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_ALGORITHM = 'HS512';
const RATE_LIMIT_TTL = 60;
const RATE_LIMIT_MAX = 10;
const TOKEN_CACHE_TTL = 300;
const TOKEN_CACHE_MAX = 10000;

/**
 * Authentication module implementing comprehensive enterprise authentication
 * with multi-strategy support and enhanced security controls.
 */
@Module({
  imports: [
    // Configure Passport with JWT as default strategy
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
      property: 'user'
    }),

    // Configure JWT with secure settings
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN,
        algorithm: JWT_ALGORITHM,
        issuer: 'codequest',
        audience: 'codequest-api'
      },
      verifyOptions: {
        algorithms: [JWT_ALGORITHM],
        issuer: 'codequest',
        audience: 'codequest-api'
      }
    }),

    // Configure rate limiting for security
    ThrottlerModule.forRoot({
      ttl: RATE_LIMIT_TTL,
      limit: RATE_LIMIT_MAX,
      ignoreUserAgents: [/^health-check/]
    }),

    // Configure token caching
    CacheModule.register({
      ttl: TOKEN_CACHE_TTL,
      max: TOKEN_CACHE_MAX,
      isGlobal: true
    })
  ],
  controllers: [AuthController],
  providers: [
    // Core authentication service
    AuthService,

    // Authentication strategies
    JwtStrategy,
    OAuthStrategy,
    SamlStrategy,

    // Security providers
    {
      provide: 'SECURITY_CONFIG',
      useValue: {
        bcryptSaltRounds: 12,
        jwtRefreshExpiration: '7d',
        passwordMinLength: 8,
        passwordMaxLength: 100,
        maxLoginAttempts: 5,
        lockoutDuration: 300, // 5 minutes
        sessionTimeout: 3600 // 1 hour
      }
    }
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule
  ]
})
export class AuthModule {}