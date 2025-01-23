/**
 * @fileoverview Points Controller implementing secure REST endpoints for points management
 * with real-time updates, AI detection, and comprehensive validation.
 * @version 1.0.0
 */

import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  UseGuards, 
  UseInterceptors,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common'; // ^10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody 
} from '@nestjs/swagger'; // ^7.0.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0
import { CacheInterceptor } from '@nestjs/cache-manager';

import { PointsService } from './points.service';
import { AwardPointsDto } from '../../dto/points/award-points.dto';
import { AuthGuard } from '../../guards/auth.guard';
import { IPointsHistory, ILevelProgress } from '../../interfaces/points.interface';

/**
 * Controller handling points-related HTTP endpoints with real-time updates,
 * AI detection, and comprehensive security measures.
 */
@Controller('points')
@ApiTags('points')
@UseGuards(AuthGuard)
@UseInterceptors(CacheInterceptor)
export class PointsController {
  private readonly logger = new Logger(PointsController.name);

  constructor(private readonly pointsService: PointsService) {}

  /**
   * Awards points to a team member for an activity with AI detection support
   * Implements real-time point calculation with 2-second SLA
   */
  @Post('award')
  @RateLimit({ ttl: 1000, limit: 10 })
  @ApiOperation({ summary: 'Award points to team member with AI detection' })
  @ApiResponse({ status: 201, description: 'Points awarded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async awardPoints(@Body() awardPointsDto: AwardPointsDto): Promise<IPointsHistory> {
    try {
      this.logger.debug(`Processing point award request for team member ${awardPointsDto.teamMemberId}`);

      const startTime = Date.now();
      const pointsHistory = await this.pointsService.awardPoints({
        teamMemberId: awardPointsDto.teamMemberId,
        activityId: awardPointsDto.activityId,
        type: awardPointsDto.activityType,
        isAiGenerated: awardPointsDto.isAiGenerated,
        points: awardPointsDto.basePoints,
        metadata: {
          aiConfidenceScore: awardPointsDto.aiConfidenceScore
        }
      });

      // Verify 2-second SLA compliance
      const processingTime = Date.now() - startTime;
      if (processingTime > 2000) {
        this.logger.warn(`Point award processing exceeded 2-second SLA: ${processingTime}ms`);
      }

      return pointsHistory;
    } catch (error) {
      this.logger.error(`Point award failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to award points',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Gets current level and progress metrics for a team member
   * Implements caching for performance optimization
   */
  @Get('level/:teamMemberId')
  @ApiOperation({ summary: 'Get detailed team member level progress' })
  @ApiResponse({ status: 200, description: 'Level progress retrieved' })
  @ApiResponse({ status: 404, description: 'Team member not found' })
  async getLevelProgress(
    @Param('teamMemberId') teamMemberId: string
  ): Promise<ILevelProgress> {
    try {
      this.logger.debug(`Retrieving level progress for team member ${teamMemberId}`);
      return await this.pointsService.getLevelProgress(teamMemberId);
    } catch (error) {
      this.logger.error(`Level progress retrieval failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to retrieve level progress',
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * Gets real-time team leaderboard with configurable sorting and filtering
   * Implements caching with frequent updates
   */
  @Get('leaderboard/:teamId')
  @ApiOperation({ summary: 'Get real-time team leaderboard' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  async getTeamLeaderboard(
    @Param('teamId') teamId: string,
    @Param('page') page: number = 1,
    @Param('limit') limit: number = 10
  ): Promise<{ items: IPointsHistory[]; total: number }> {
    try {
      this.logger.debug(`Retrieving leaderboard for team ${teamId}`);
      return await this.pointsService.getTeamLeaderboard(
        teamId,
        page,
        limit
      );
    } catch (error) {
      this.logger.error(`Leaderboard retrieval failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to retrieve leaderboard',
        HttpStatus.BAD_REQUEST
      );
    }
  }
}