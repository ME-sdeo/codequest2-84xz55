/**
 * @fileoverview Root module for CodeQuest NestJS backend application
 * Implements comprehensive system configuration with multi-tenant support,
 * enhanced security controls, and real-time performance monitoring
 * @version 1.0.0
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { APP_PIPE, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Configuration imports
import { appConfig } from './config/app.config';

// Feature modules
import { ActivityModule } from './modules/activity/activity.module';
import { AuthModule } from './modules/auth/auth.module';
import { PointsModule } from './modules/points/points.module';

// Security interceptors and middleware
import { SecurityInterceptor } from './interceptors/security.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';

/**
 * Root module configuring the entire NestJS application with enhanced security,
 * multi-tenant support, and comprehensive monitoring capabilities.
 */
@Module({
  imports: [
    // Global configuration with environment variable support
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      cache: true,
      expandVariables: true
    }),

    // Database configuration with multi-tenant support
    TypeOrmModule.forRoot({
      ...appConfig.databaseConfig,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
      maxQueryExecutionTime: 1000, // Log slow queries
      extra: {
        max: 100, // Connection pool size
        ssl: process.env.NODE_ENV === 'production'
      }
    }),

    // Rate limiting for API protection
    ThrottlerModule.forRoot({
      ttl: appConfig.throttleConfig.ttl,
      limit: appConfig.throttleConfig.limit,
      ignoreUserAgents: [/health-check/]
    }),

    // Queue configuration for asynchronous tasks
    BullModule.forRoot({
      ...appConfig.queueConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true
      }
    }),

    // Feature modules
    ActivityModule,
    AuthModule,
    PointsModule
  ],
  providers: [
    // Global validation pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: false
        }
      })
    },

    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },

    // Global interceptors for security, logging, and monitoring
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor
    }
  ]
})
export class AppModule {
  constructor() {
    // Validate required environment variables
    this.validateEnvironment();
  }

  /**
   * Validates required environment variables on application startup
   * @private
   */
  private validateEnvironment(): void {
    const requiredEnvVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'API_PREFIX'
    ];

    const missingVars = requiredEnvVars.filter(
      envVar => !process.env[envVar]
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`
      );
    }
  }
}