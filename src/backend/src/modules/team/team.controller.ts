/**
 * @fileoverview Enhanced team controller implementing secure REST endpoints for team management
 * with multi-tenant support, real-time point tracking, and comprehensive validation
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  ValidationPipe,
  ParseUUIDPipe,
  Logger
} from '@nestjs/common'; // v10.0.0
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiBody,
  ApiQuery
} from '@nestjs/swagger'; // v7.0.0
import { RateLimit } from '@nestjs/throttler'; // v5.0.0
import { AuthGuard, TenantGuard, RolesGuard } from '@nestjs/core'; // v10.0.0

import { TeamService } from './team.service';
import { CreateTeamDto } from '../../dto/team/create-team.dto';
import { UpdateTeamDto } from '../../dto/team/update-team.dto';
import { LoggingInterceptor } from '../../interceptors/logging.interceptor';
import { TimeoutInterceptor } from '../../interceptors/timeout.interceptor';
import { Roles } from '../../decorators/roles.decorator';
import { ROLES } from '../../constants/roles.constants';

/**
 * Controller implementing secure team management endpoints with multi-tenant support
 * Includes comprehensive validation, rate limiting, and monitoring
 */
@Controller('api/v1/teams')
@ApiTags('teams')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@UseInterceptors(LoggingInterceptor, TimeoutInterceptor)
@ApiSecurity('bearer')
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(private readonly teamService: TeamService) {}

  /**
   * Creates a new team within an organization
   * Implements strict validation and security checks
   */
  @Post()
  @Roles(ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @RateLimit({ ttl: 60, limit: 10 })
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBody({ type: CreateTeamDto })
  async createTeam(
    @Body(new ValidationPipe({ transform: true })) createTeamDto: CreateTeamDto
  ) {
    this.logger.debug(`Creating team: ${createTeamDto.name}`);
    return await this.teamService.createTeam(createTeamDto);
  }

  /**
   * Retrieves teams for an organization with pagination
   * Implements caching and performance optimization
   */
  @Get('organization/:organizationId')
  @Roles(ROLES.DEVELOPER, ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Get teams by organization' })
  @ApiParam({ name: 'organizationId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'page', type: 'number', required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTeamsByOrganization(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    this.logger.debug(`Retrieving teams for organization: ${organizationId}`);
    return await this.teamService.getTeamsByOrganization(organizationId, { page, limit });
  }

  /**
   * Adds a member to a team with capacity validation
   * Implements real-time member count tracking
   */
  @Post(':teamId/members/:userId')
  @Roles(ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Add team member' })
  @ApiParam({ name: 'teamId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Member added successfully' })
  @ApiResponse({ status: 400, description: 'Team capacity exceeded' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async addTeamMember(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string
  ) {
    this.logger.debug(`Adding member ${userId} to team ${teamId}`);
    return await this.teamService.addTeamMember(teamId, userId);
  }

  /**
   * Removes a member from a team
   * Implements audit logging and member count updates
   */
  @Delete(':teamId/members/:userId')
  @Roles(ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove team member' })
  @ApiParam({ name: 'teamId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async removeTeamMember(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string
  ) {
    this.logger.debug(`Removing member ${userId} from team ${teamId}`);
    await this.teamService.removeTeamMember(teamId, userId);
  }

  /**
   * Retrieves team leaderboard with real-time point tracking
   * Implements caching and pagination
   */
  @Get(':teamId/leaderboard')
  @Roles(ROLES.DEVELOPER, ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Get team leaderboard' })
  @ApiParam({ name: 'teamId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'page', type: 'number', required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTeamLeaderboard(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    this.logger.debug(`Retrieving leaderboard for team ${teamId}`);
    return await this.teamService.getTeamLeaderboard(teamId, { page, limit });
  }

  /**
   * Updates team information with validation
   * Implements audit logging and cache invalidation
   */
  @Put(':teamId')
  @Roles(ROLES.ORG_ADMIN, ROLES.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update team information' })
  @ApiParam({ name: 'teamId', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateTeamDto })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateTeam(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body(new ValidationPipe({ transform: true })) updateTeamDto: UpdateTeamDto
  ) {
    this.logger.debug(`Updating team ${teamId}`);
    return await this.teamService.updateTeam(teamId, updateTeamDto);
  }
}