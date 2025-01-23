import { Injectable } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import { 
  IPointsConfig, 
  IPointsHistory, 
  IPointsCalculation, 
  ILevelProgress 
} from '../../interfaces/points.interface';
import { PointsHistoryRepository } from '../../repositories/points-history.repository';
import { CacheService } from '../../services/cache.service';
import { AiDetectionService } from '../../services/ai-detection.service';
import { ActivityType, IActivity } from '../../interfaces/activity.interface';
import { 
  DEFAULT_POINTS_CONFIG, 
  LEVEL_THRESHOLDS, 
  validatePointsConfig 
} from '../../constants/points.constants';
import { LoggerService } from '../../services/logger.service';

@Injectable()
export class PointsService {
  @WebSocketServer()
  private readonly server: any;

  private readonly retryConfig = {
    attempts: 3,
    delay: 1000,
    factor: 2
  };

  constructor(
    private readonly pointsHistoryRepository: PointsHistoryRepository,
    private readonly cacheService: CacheService,
    private readonly aiDetectionService: AiDetectionService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext('PointsService');
  }

  /**
   * Calculates points for an activity with AI detection and tenant-specific rules
   * @param activity Activity to calculate points for
   * @param tenantId Tenant identifier
   * @returns Calculated points with modifiers
   */
  async calculatePoints(
    activity: IActivity,
    tenantId: string
  ): Promise<IPointsCalculation> {
    try {
      // Get tenant-specific point configuration from cache
      const cacheKey = `points_config:${tenantId}`;
      let pointConfig = await this.cacheService.get<IPointsConfig>(cacheKey);

      if (!pointConfig) {
        pointConfig = DEFAULT_POINTS_CONFIG;
        await this.cacheService.set(cacheKey, pointConfig, tenantId);
      }

      // Validate point configuration
      if (!validatePointsConfig(pointConfig)) {
        throw new Error('Invalid points configuration');
      }

      // Get base points for activity type
      const basePoints = pointConfig.basePoints[activity.type];
      if (!basePoints) {
        throw new Error(`No base points defined for activity type: ${activity.type}`);
      }

      // Detect AI-generated code
      const isAiGenerated = await this.aiDetectionService.detectAiGenerated(activity);
      const aiModifier = isAiGenerated ? pointConfig.aiModifier : 1;

      // Calculate final points
      const finalPoints = Math.round(basePoints * aiModifier);

      // Create calculation result
      const calculation: IPointsCalculation = {
        basePoints,
        aiModifier,
        finalPoints,
        activityType: activity.type,
        tenantId
      };

      // Log calculation details
      this.logger.debug('Points calculation completed', {
        activityId: activity.id,
        calculation,
        isAiGenerated
      });

      return calculation;
    } catch (error) {
      this.logger.error('Points calculation failed', error, {
        activityId: activity.id,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Awards points to a team member with real-time updates
   * @param activity Activity to award points for
   * @param tenantId Tenant identifier
   * @returns Updated points history
   */
  async awardPoints(
    activity: IActivity,
    tenantId: string
  ): Promise<IPointsHistory> {
    try {
      // Calculate points with AI detection
      const calculation = await this.calculatePoints(activity, tenantId);

      // Create points history record with transaction
      const pointsHistory = await this.pointsHistoryRepository.createPointsHistoryWithTransaction({
        teamMemberId: activity.teamMemberId,
        activityId: activity.id,
        points: calculation.finalPoints,
        activityType: activity.type,
        isAiGenerated: activity.isAiGenerated,
        tenantId
      });

      // Update cache and send real-time update
      await this.updatePointsCache(activity.teamMemberId, tenantId);
      this.sendRealTimeUpdate(activity.teamMemberId, calculation.finalPoints, tenantId);

      return pointsHistory;
    } catch (error) {
      this.logger.error('Points award failed', error, {
        activityId: activity.id,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Gets level progress for a team member
   * @param teamMemberId Team member identifier
   * @param tenantId Tenant identifier
   * @returns Level progress information
   */
  async getLevelProgress(
    teamMemberId: string,
    tenantId: string
  ): Promise<ILevelProgress> {
    try {
      // Get total points from cache or database
      const totalPoints = await this.getTotalPoints(teamMemberId, tenantId);

      // Calculate current level and progress
      let currentLevel = 1;
      let nextLevelThreshold = 0;

      for (const [level, threshold] of LEVEL_THRESHOLDS.entries()) {
        if (totalPoints >= threshold) {
          currentLevel = level;
        } else {
          nextLevelThreshold = threshold;
          break;
        }
      }

      const currentThreshold = LEVEL_THRESHOLDS.get(currentLevel) || 0;
      const progressPoints = totalPoints - currentThreshold;
      const levelRange = nextLevelThreshold - currentThreshold;
      const progressPercentage = Math.min((progressPoints / levelRange) * 100, 100);

      return {
        currentLevel,
        totalPoints,
        nextLevelThreshold,
        progressPercentage,
        tenantId
      };
    } catch (error) {
      this.logger.error('Level progress calculation failed', error, {
        teamMemberId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Gets team leaderboard with pagination
   * @param teamId Team identifier
   * @param tenantId Tenant identifier
   * @param page Page number
   * @param limit Items per page
   * @returns Paginated leaderboard results
   */
  async getTeamLeaderboard(
    teamId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: IPointsHistory[]; total: number }> {
    const cacheKey = `leaderboard:${teamId}:${page}:${limit}`;
    try {
      // Check cache first
      const cached = await this.cacheService.get(cacheKey, tenantId);
      if (cached) {
        return cached;
      }

      // Get leaderboard from repository
      const result = await this.pointsHistoryRepository.getUserPointsHistoryWithCursor(
        teamId,
        { cursor: undefined, limit, direction: 'forward' }
      );

      // Cache results
      await this.cacheService.set(cacheKey, result, tenantId, { ttl: 300 }); // 5 minutes cache

      return result;
    } catch (error) {
      this.logger.error('Leaderboard retrieval failed', error, {
        teamId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Updates points cache for a team member
   * @private
   */
  private async updatePointsCache(
    teamMemberId: string,
    tenantId: string
  ): Promise<void> {
    const totalPoints = await this.pointsHistoryRepository.getTotalPointsByTeamMember(teamMemberId);
    await this.cacheService.set(
      `total_points:${teamMemberId}`,
      totalPoints,
      tenantId,
      { ttl: 3600 }
    );
  }

  /**
   * Gets total points for a team member
   * @private
   */
  private async getTotalPoints(
    teamMemberId: string,
    tenantId: string
  ): Promise<number> {
    const cacheKey = `total_points:${teamMemberId}`;
    const cached = await this.cacheService.get<number>(cacheKey, tenantId);
    
    if (cached !== null) {
      return cached;
    }

    const total = await this.pointsHistoryRepository.getTotalPointsByTeamMember(teamMemberId);
    await this.cacheService.set(cacheKey, total, tenantId, { ttl: 3600 });
    
    return total;
  }

  /**
   * Sends real-time point update via WebSocket
   * @private
   */
  private sendRealTimeUpdate(
    teamMemberId: string,
    points: number,
    tenantId: string
  ): void {
    this.server.to(`tenant:${tenantId}`).emit('pointsUpdate', {
      teamMemberId,
      points,
      timestamp: new Date().toISOString()
    });
  }
}