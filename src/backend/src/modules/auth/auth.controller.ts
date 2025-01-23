/**
 * @fileoverview Authentication controller implementing secure authentication flows
 * with comprehensive validation, monitoring, and multi-tenant support.
 * @version 1.0.0
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  ValidationPipe,
  UseInterceptors,
  Logger,
  UnauthorizedException,
  BadRequestException
} from '@nestjs/common'; // ^10.0.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0
import { TimeoutInterceptor } from '@nestjs/core'; // ^10.0.0
import { AuthService } from './auth.service';
import { LoginDto } from '../../dto/auth/login.dto';
import { RegisterDto } from '../../dto/auth/register.dto';

/**
 * Controller handling authentication endpoints with comprehensive security controls
 * Implements rate limiting, request validation, and security monitoring
 */
@Controller('auth')
@RateLimit({ ttl: 60, limit: 10 }) // Rate limit: 10 requests per minute
@UseInterceptors(TimeoutInterceptor)
@UseGuards(ValidationPipe)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Handles user login requests with security logging and tenant validation
   * @param loginDto - Validated login credentials
   * @returns Promise resolving to JWT tokens
   * @throws UnauthorizedException for invalid credentials
   * @throws BadRequestException for validation failures
   */
  @Post('login')
  @UseGuards(ValidationPipe)
  async login(
    @Body() loginDto: LoginDto
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      this.logger.log({
        message: 'Login attempt',
        email: loginDto.email,
        timestamp: new Date().toISOString()
      });

      // Validate user credentials
      const user = await this.authService.validateUser(loginDto);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate tokens
      const tokens = await this.authService.generateToken(user);

      this.logger.log({
        message: 'Login successful',
        email: loginDto.email,
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      return tokens;
    } catch (error) {
      this.logger.error({
        message: 'Login failed',
        email: loginDto.email,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Handles user registration with SSO data validation and security logging
   * @param registerDto - Validated registration data
   * @returns Promise resolving to JWT tokens
   * @throws BadRequestException for validation failures
   */
  @Post('register')
  @UseGuards(ValidationPipe)
  async register(
    @Body() registerDto: RegisterDto
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      this.logger.log({
        message: 'Registration attempt',
        email: registerDto.email,
        role: registerDto.role,
        timestamp: new Date().toISOString()
      });

      // Validate and create user with SSO data if provided
      const user = await this.authService.validateSSOUser({
        email: registerDto.email,
        role: registerDto.role,
        ...registerDto.ssoData
      });

      // Generate tokens for new user
      const tokens = await this.authService.generateToken(user);

      this.logger.log({
        message: 'Registration successful',
        email: registerDto.email,
        userId: user.id,
        role: registerDto.role,
        timestamp: new Date().toISOString()
      });

      return tokens;
    } catch (error) {
      this.logger.error({
        message: 'Registration failed',
        email: registerDto.email,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Handles SSO authentication callbacks with proper validation and error handling
   * @param ssoProfile - SSO provider profile data
   * @returns Promise resolving to JWT tokens
   * @throws BadRequestException for invalid SSO data
   */
  @Post('sso/callback')
  @UseGuards(ValidationPipe)
  async ssoCallback(
    @Body() ssoProfile: Record<string, any>
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      this.logger.log({
        message: 'SSO callback received',
        provider: ssoProfile.provider,
        email: ssoProfile.email,
        timestamp: new Date().toISOString()
      });

      if (!ssoProfile.email || !ssoProfile.provider) {
        throw new BadRequestException('Invalid SSO profile data');
      }

      // Validate SSO user data
      const user = await this.authService.validateSSOUser(ssoProfile);

      // Generate tokens for SSO user
      const tokens = await this.authService.generateToken(user);

      this.logger.log({
        message: 'SSO authentication successful',
        provider: ssoProfile.provider,
        email: ssoProfile.email,
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      return tokens;
    } catch (error) {
      this.logger.error({
        message: 'SSO authentication failed',
        provider: ssoProfile?.provider,
        email: ssoProfile?.email,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}