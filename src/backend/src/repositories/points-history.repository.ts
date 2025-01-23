/**
 * @fileoverview Points History Repository implementing comprehensive points history management
 * with transaction support, caching, and audit trails
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // ^10.0.0
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, QueryRunner } from 'typeorm'; // ^0.3.0
import { InjectRepository } from '@nestjs/typeorm';
import { UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheManager } from '@nestjs/cache-manager'; // ^1.0.0
import { PointsHistory } from '../entities/points-history.entity';
import { ActivityType } from '../interfaces/activity.interface';

/**
 * Interface for cursor-based pagination options
 */
interface CursorPaginationOptions {
  cursor?: string;
  limit: number;
  direction: 'forward' | 'backward';
}

/**
 * Interface for paginated response
 */
interface CursorPaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Repository class for managing points history records with enhanced functionality
 */
@Injectable()
@UseInterceptors(CacheInterceptor)
export class PointsHistoryRepository {
  constructor(
    @InjectRepository(PointsHistory)
    private readonly repository: Repository<PointsHistory>,
    private readonly cacheManager: CacheManager
  ) {}

  /**
   * Creates a new points history record with transaction support
   * @param data Partial points history data
   * @param queryRunner Optional query runner for transaction support
   * @returns Created points history record
   */
  async createPointsHistoryWithTransaction(
    data: Partial<PointsHistory>,
    queryRunner?: QueryRunner
  ): Promise<PointsHistory> {
    const shouldManageTransaction = !queryRunner;
    const runner = queryRunner || this.repository.manager.connection.createQueryRunner();

    try {
      if (shouldManageTransaction) {
        await runner.connect();
        await runner.startTransaction();
      }

      const pointsHistory = new PointsHistory(data);
      
      // Calculate points if not provided
      if (!pointsHistory.points && pointsHistory.basePoints) {
        pointsHistory.points = pointsHistory.calculateFinalPoints();
      }

      // Add audit trail entry
      pointsHistory.updateAuditTrail(
        'CREATED',
        `Points history created for ${data.activityType} with ${pointsHistory.points} points`
      );

      const savedRecord = await runner.manager.save(PointsHistory, pointsHistory);

      if (shouldManageTransaction) {
        await runner.commitTransaction();
      }

      // Invalidate relevant caches
      await this.invalidateUserPointsCache(savedRecord.teamMemberId);

      return savedRecord;
    } catch (error) {
      if (shouldManageTransaction && runner.isTransactionActive) {
        await runner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (shouldManageTransaction && runner.isConnected) {
        await runner.release();
      }
    }
  }

  /**
   * Retrieves points history for a user with cursor-based pagination
   * @param teamMemberId Team member ID
   * @param options Pagination options
   * @returns Paginated points history records
   */
  async getUserPointsHistoryWithCursor(
    teamMemberId: string,
    options: CursorPaginationOptions
  ): Promise<CursorPaginatedResponse<PointsHistory>> {
    const { cursor, limit, direction } = options;
    const cacheKey = `points_history:${teamMemberId}:${cursor}:${limit}:${direction}`;
    
    // Check cache first
    const cached = await this.cacheManager.get<CursorPaginatedResponse<PointsHistory>>(cacheKey);
    if (cached) {
      return cached;
    }

    const queryBuilder = this.repository.createQueryBuilder('points_history')
      .where('points_history.teamMemberId = :teamMemberId', { teamMemberId })
      .orderBy('points_history.createdAt', direction === 'forward' ? 'ASC' : 'DESC')
      .take(limit + 1);

    if (cursor) {
      const operator = direction === 'forward' ? MoreThanOrEqual : LessThanOrEqual;
      queryBuilder.andWhere('points_history.createdAt ' + operator, { cursor });
    }

    const items = await queryBuilder.getMany();
    const hasMore = items.length > limit;
    const results = items.slice(0, limit);
    
    const response: CursorPaginatedResponse<PointsHistory> = {
      items: results,
      hasMore,
      nextCursor: hasMore ? items[limit - 1].createdAt.toISOString() : undefined
    };

    // Cache the results
    await this.cacheManager.set(cacheKey, response, 60000); // Cache for 1 minute

    return response;
  }

  /**
   * Gets points history within a date range
   * @param teamMemberId Team member ID
   * @param startDate Start date
   * @param endDate End date
   * @returns Points history records within range
   */
  async getPointsHistoryByDateRange(
    teamMemberId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PointsHistory[]> {
    return this.repository.find({
      where: {
        teamMemberId,
        createdAt: Between(startDate, endDate)
      },
      order: {
        createdAt: 'DESC'
      }
    });
  }

  /**
   * Gets points summary by activity type
   * @param teamMemberId Team member ID
   * @param activityType Activity type
   * @returns Points summary
   */
  async getPointsSummaryByActivityType(
    teamMemberId: string,
    activityType: ActivityType
  ): Promise<{ total: number; aiGenerated: number; standard: number }> {
    const records = await this.repository.find({
      where: {
        teamMemberId,
        activityType
      }
    });

    return records.reduce((acc, record) => ({
      total: acc.total + record.points,
      aiGenerated: acc.aiGenerated + (record.isAiGenerated ? record.points : 0),
      standard: acc.standard + (record.isAiGenerated ? 0 : record.points)
    }), { total: 0, aiGenerated: 0, standard: 0 });
  }

  /**
   * Invalidates user points cache
   * @param teamMemberId Team member ID
   * @private
   */
  private async invalidateUserPointsCache(teamMemberId: string): Promise<void> {
    const cachePattern = `points_history:${teamMemberId}:*`;
    await this.cacheManager.del(cachePattern);
  }
}