/**
 * @fileoverview Analytics module implementing comprehensive analytics functionality
 * with real-time updates, multi-tenant isolation, and enterprise scalability
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PointsHistoryRepository } from '../../repositories/points-history.repository';
import { ActivityRepository } from '../../repositories/activity.repository';
import { CacheService } from '../../services/cache.service';
import { LoggerService } from '../../services/logger.service';

/**
 * Analytics module providing enterprise-grade analytics functionality
 * Implements real-time updates, multi-tenant isolation, and performance monitoring
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointsHistoryRepository,
      ActivityRepository
    ])
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    CacheService,
    LoggerService,
    {
      provide: 'ANALYTICS_CONFIG',
      useValue: {
        // Real-time update configuration
        realTimeUpdateInterval: 2000, // 2 seconds per technical spec
        // Cache configuration for performance
        cacheTTL: {
          userMetrics: 30, // 30 seconds
          teamMetrics: 60, // 1 minute
          trendReport: 300, // 5 minutes
          activityStats: 120 // 2 minutes
        },
        // Data retention configuration
        retentionPeriod: {
          activityHistory: 12, // 12 months per technical spec
          pointsHistory: 24, // 24 months for trending
          auditLogs: 36 // 36 months for compliance
        },
        // Performance monitoring thresholds
        performance: {
          maxResponseTime: 500, // 500ms per technical spec
          warningThreshold: 400, // 80% of max
          errorThreshold: 450 // 90% of max
        }
      }
    }
  ],
  exports: [AnalyticsService]
})
export class AnalyticsModule {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('AnalyticsModule');
    this.logger.info('Analytics module initialized with enterprise configuration');
  }
}