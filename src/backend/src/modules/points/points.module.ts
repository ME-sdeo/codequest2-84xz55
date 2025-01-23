/**
 * @fileoverview Points module configuration implementing comprehensive points management
 * with real-time updates, AI detection, and multi-tenant support.
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { CacheModule } from '@nestjs/cache-manager'; // ^10.0.0

import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { PointsHistoryRepository } from '../../repositories/points-history.repository';
import { AiDetectionService } from '../../services/ai-detection.service';
import { CacheService } from '../../services/cache.service';
import { LoggerService } from '../../services/logger.service';

/**
 * Module configuring points management functionality with real-time updates,
 * AI detection, and multi-tenant support.
 */
@Module({
  imports: [
    // Configure TypeORM with points history repository
    TypeOrmModule.forFeature([PointsHistoryRepository]),
    
    // Configure cache with 60-second TTL for real-time updates
    CacheModule.register({
      ttl: 60,
      max: 1000, // Maximum number of items in cache
      isGlobal: false
    })
  ],
  controllers: [PointsController],
  providers: [
    PointsService,
    AiDetectionService,
    CacheService,
    LoggerService,
    {
      provide: 'POINTS_CONFIG',
      useValue: {
        realTimeUpdateThreshold: 2000, // 2-second SLA requirement
        aiDetectionEnabled: true,
        multiTenantEnabled: true
      }
    }
  ],
  exports: [
    PointsService, 
    AiDetectionService,
    CacheService
  ]
})
export class PointsModule {
  constructor() {
    // Module initialization logic if needed
  }
}