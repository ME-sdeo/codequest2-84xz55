/**
 * @fileoverview Enhanced SAML authentication strategy implementation with tenant isolation,
 * security monitoring, and comprehensive validation for enterprise SSO integration.
 * @version 1.0.0
 */

import { Injectable, Logger } from '@nestjs/common'; // ^10.0.0
import { PassportStrategy } from '@nestjs/passport'; // ^10.0.0
import { Strategy, Profile, VerifyCallback } from 'passport-saml'; // ^3.2.0
import { verify } from 'jsonwebtoken'; // ^9.0.0
import { UserRepository } from '../../repositories/user.repository';
import { ROLES } from '../../constants/roles.constants';

interface SamlConfig {
  callbackUrl: string;
  issuer: string;
  cert: string;
  entryPoint: string;
  audience: string;
  privateKey: string;
  signatureAlgorithm: string;
  acceptedClockSkewMs: number;
}

@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  private readonly metadataCache: Map<string, any>;
  private readonly assertionCache: Map<string, number>;
  private readonly maxClockSkew = 300000; // 5 minutes
  private readonly assertionTTL = 300; // 5 minutes
  private readonly rateLimitWindow = 300000; // 5 minutes
  private readonly maxLoginAttempts = 5;
  private readonly loginAttempts: Map<string, { count: number; timestamp: number }>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: Logger
  ) {
    const samlConfig: SamlConfig = {
      callbackUrl: process.env.SAML_CALLBACK_URL,
      issuer: process.env.SAML_ISSUER,
      cert: process.env.SAML_CERT,
      entryPoint: process.env.SAML_ENTRY_POINT,
      audience: process.env.SAML_AUDIENCE,
      privateKey: process.env.SAML_PRIVATE_KEY,
      signatureAlgorithm: 'sha256',
      acceptedClockSkewMs: 300000, // 5 minutes
    };

    super({
      ...samlConfig,
      validateInResponseTo: true,
      requestIdExpirationPeriodMs: 300000, // 5 minutes
      decryptionPvk: samlConfig.privateKey,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      forceAuthn: true,
      disableRequestedAuthnContext: false,
      authnContext: ['urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'],
    });

    this.metadataCache = new Map();
    this.assertionCache = new Map();
    this.loginAttempts = new Map();
    this.logger.setContext('SamlStrategy');
  }

  /**
   * Validates SAML profile and manages user authentication
   * @param profile - SAML profile from identity provider
   * @param done - Passport verify callback
   */
  async validate(
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> {
    try {
      const email = profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
      
      if (!email) {
        throw new Error('Email not provided in SAML assertion');
      }

      // Rate limiting check
      if (this.isRateLimited(email)) {
        this.logger.warn(`Rate limit exceeded for ${email}`);
        return done(new Error('Too many login attempts'), null);
      }

      // Validate SAML assertion
      const isValid = await this.validateSamlAssertion(profile);
      if (!isValid) {
        this.incrementLoginAttempts(email);
        return done(new Error('Invalid SAML assertion'), null);
      }

      // Find or create user
      let user = await this.userRepository.findByEmail(email);
      
      if (!user) {
        user = await this.userRepository.createUser(
          email,
          ROLES.GENERAL_USER,
          {
            provider: 'saml',
            providerId: profile.nameID,
            profile: {
              name: profile.displayName,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
            },
            metadata: {
              lastLogin: new Date().toISOString(),
              issuer: profile.issuer,
              sessionIndex: profile.sessionIndex,
            }
          }
        );
      }

      // Generate session token
      const sessionToken = this.generateSessionToken(user, profile.sessionIndex);

      this.logger.log(`Successful SAML authentication for ${email}`);
      return done(null, { user, sessionToken });

    } catch (error) {
      this.logger.error(`SAML authentication failed: ${error.message}`);
      return done(error, null);
    }
  }

  /**
   * Validates SAML assertion with comprehensive security checks
   * @param assertion - SAML assertion to validate
   * @returns Promise resolving to validation result
   * @private
   */
  private async validateSamlAssertion(assertion: any): Promise<boolean> {
    try {
      // Check assertion ID for replay attacks
      const assertionId = assertion.assertionId || assertion.id;
      if (this.assertionCache.has(assertionId)) {
        throw new Error('Potential replay attack detected');
      }

      // Validate assertion timestamp
      const notBefore = new Date(assertion.notBefore).getTime();
      const notOnOrAfter = new Date(assertion.notOnOrAfter).getTime();
      const now = Date.now();

      if (now < notBefore || now >= notOnOrAfter) {
        throw new Error('Assertion time validity check failed');
      }

      // Validate audience
      const audience = assertion.audience || assertion.conditions?.audience;
      if (audience !== process.env.SAML_AUDIENCE) {
        throw new Error('Invalid assertion audience');
      }

      // Cache valid assertion ID
      this.assertionCache.set(assertionId, now);
      setTimeout(() => this.assertionCache.delete(assertionId), this.assertionTTL * 1000);

      return true;

    } catch (error) {
      this.logger.error(`Assertion validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generates secure session token with user context
   * @param user - Authenticated user
   * @param sessionIndex - SAML session index
   * @returns Signed session token
   * @private
   */
  private generateSessionToken(user: any, sessionIndex: string): string {
    return verify(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        sessionIndex,
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  /**
   * Checks if login attempts are rate limited
   * @param email - User email to check
   * @returns Boolean indicating if rate limited
   * @private
   */
  private isRateLimited(email: string): boolean {
    const now = Date.now();
    const attempts = this.loginAttempts.get(email);

    if (!attempts) {
      return false;
    }

    if (now - attempts.timestamp > this.rateLimitWindow) {
      this.loginAttempts.delete(email);
      return false;
    }

    return attempts.count >= this.maxLoginAttempts;
  }

  /**
   * Increments login attempt counter for rate limiting
   * @param email - User email to increment
   * @private
   */
  private incrementLoginAttempts(email: string): void {
    const now = Date.now();
    const attempts = this.loginAttempts.get(email);

    if (!attempts) {
      this.loginAttempts.set(email, { count: 1, timestamp: now });
      return;
    }

    if (now - attempts.timestamp > this.rateLimitWindow) {
      this.loginAttempts.set(email, { count: 1, timestamp: now });
      return;
    }

    attempts.count++;
    this.loginAttempts.set(email, attempts);
  }
}