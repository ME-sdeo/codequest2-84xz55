/**
 * @fileoverview Company module configuration for CodeQuest's multi-tenant architecture
 * Implements company management with AI-aware point system and real-time processing
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { CacheModule } from '@nestjs/cache-manager'; // ^2.0.0
import { BullModule } from '@nestjs/bull'; // ^1.0.0

import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanyRepository } from '../../repositories/company.repository';

/**
 * NestJS module configuring company management functionality with AI-aware point system
 * Implements multi-tenant architecture with real-time point processing capabilities
 */
@Module({
  imports: [
    // Configure TypeORM for company entity management
    TypeOrmModule.forFeature([CompanyRepository]),

    // Configure caching for point configurations and company data
    CacheModule.register({
      ttl: 3600, // 1 hour cache TTL
      max: 100, // Maximum number of items in cache
      isGlobal: false
    }),

    // Configure Bull for real-time point processing queues
    BullModule.registerQueue({
      name: 'points-processing',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        timeout: 5000
      },
      limiter: {
        max: 1000, // Maximum number of jobs processed per timeWindow
        duration: 5000 // Time window in milliseconds
      }
    })
  ],
  controllers: [CompanyController],
  providers: [
    CompanyService,
    CompanyRepository
  ],
  exports: [
    CompanyService,
    TypeOrmModule.forFeature([CompanyRepository])
  ]
})
export class CompanyModule {
  // Cache configuration constants
  private static readonly CACHE_TTL_SECONDS = 3600;
  private static readonly CACHE_MAX_ITEMS = 100;

  // Points processing queue configuration
  private static readonly POINTS_QUEUE_NAME = 'points-processing';
  private static readonly POINTS_QUEUE_CONCURRENCY = 10;
  private static readonly POINTS_QUEUE_MAX_ATTEMPTS = 3;
}