/**
 * @fileoverview Analytics controller implementing comprehensive analytics functionality
 * with real-time updates, multi-tenant isolation, and AI code detection support
 * @version 1.0.0
 */

import { 
  Controller, 
  Get, 
  Query, 
  UseGuards, 
  ValidationPipe, 
  UseInterceptors,
  ParseUUIDPipe,
  Param,
  CacheTTL,
  Logger,
  HttpStatus,
  BadRequestException
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiQuery,
  ApiBearerAuth,
  ApiParam
} from '@nestjs/swagger';
import { RateLimit } from '@nestjs/throttler';

import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../../guards/auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { CacheInterceptor } from '../../interceptors/cache.interceptor';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants/roles.constants';
import { DateRangeDto } from '../../dto/date-range.dto';
import { UserPerformanceMetricsDto } from '../../dto/user-performance-metrics.dto';
import { TeamAnalyticsDto } from '../../dto/team-analytics.dto';
import { TrendReportDto } from '../../dto/trend-report.dto';
import { ActivityDistributionDto } from '../../dto/activity-distribution.dto';

@Controller('analytics')
@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(CacheInterceptor)
@RateLimit({ ttl: 60, limit: 100 })
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('user/:teamMemberId')
  @ApiOperation({ summary: 'Get user performance metrics' })
  @ApiParam({ name: 'teamMemberId', type: String, description: 'Team member UUID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    type: UserPerformanceMetricsDto,
    description: 'User performance metrics including AI detection data'
  })
  @Roles(ROLES.DEVELOPER, ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @CacheTTL(30) // 30 seconds cache for real-time updates
  async getUserMetrics(
    @Param('teamMemberId', ParseUUIDPipe) teamMemberId: string,
    @Query(new ValidationPipe({ transform: true })) dateRange: DateRangeDto
  ): Promise<UserPerformanceMetricsDto> {
    this.logger.debug(`Fetching user metrics for teamMemberId: ${teamMemberId}`);
    
    try {
      return await this.analyticsService.getUserPerformanceMetrics(
        teamMemberId,
        dateRange,
        { companyId: 'req.tenant.companyId' } // Tenant context from request
      );
    } catch (error) {
      this.logger.error(`Error fetching user metrics: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve user metrics');
    }
  }

  @Get('team/:teamId')
  @ApiOperation({ summary: 'Get team analytics' })
  @ApiParam({ name: 'teamId', type: String, description: 'Team UUID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    type: TeamAnalyticsDto,
    description: 'Team analytics with AI vs manual code metrics'
  })
  @Roles(ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @CacheTTL(60) // 1 minute cache
  async getTeamMetrics(
    @Param('teamId', ParseUUIDPipe) teamId: string
  ): Promise<TeamAnalyticsDto> {
    this.logger.debug(`Fetching team analytics for teamId: ${teamId}`);
    
    try {
      return await this.analyticsService.getTeamAnalytics(
        teamId,
        { companyId: 'req.tenant.companyId' }
      );
    } catch (error) {
      this.logger.error(`Error fetching team analytics: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve team analytics');
    }
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get trend report' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    type: TrendReportDto,
    description: 'Historical trend report with AI detection analysis'
  })
  @Roles(ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @CacheTTL(300) // 5 minutes cache
  async getTrendReport(
    @Query(new ValidationPipe({ transform: true })) dateRange: DateRangeDto
  ): Promise<TrendReportDto> {
    this.logger.debug('Generating trend report');
    
    try {
      return await this.analyticsService.generateTrendReport(
        dateRange,
        { companyId: 'req.tenant.companyId' }
      );
    } catch (error) {
      this.logger.error(`Error generating trend report: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to generate trend report');
    }
  }

  @Get('activity-distribution/:teamId')
  @ApiOperation({ summary: 'Get activity distribution' })
  @ApiParam({ name: 'teamId', type: String, description: 'Team UUID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    type: ActivityDistributionDto,
    description: 'Activity distribution with AI vs manual breakdown'
  })
  @Roles(ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @CacheTTL(120) // 2 minutes cache
  async getActivityStats(
    @Param('teamId', ParseUUIDPipe) teamId: string
  ): Promise<ActivityDistributionDto> {
    this.logger.debug(`Fetching activity distribution for teamId: ${teamId}`);
    
    try {
      return await this.analyticsService.getActivityDistribution(
        teamId,
        { companyId: 'req.tenant.companyId' }
      );
    } catch (error) {
      this.logger.error(`Error fetching activity distribution: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve activity distribution');
    }
  }
}