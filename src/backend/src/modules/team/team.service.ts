/**
 * @fileoverview Enhanced team service implementing comprehensive team management business logic
 * with security, performance optimization, and audit logging for the CodeQuest platform
 * @version 1.0.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@nestjs/typeorm';

import { TeamEntity } from '../../entities/team.entity';
import { TeamRepository } from '../../repositories/team.repository';
import { CacheService } from '../../services/cache.service';
import { TenantConfig } from '../../interfaces/tenant.interface';

// Cache TTL constants
const TEAM_CACHE_TTL = 3600; // 1 hour
const LEADERBOARD_CACHE_TTL = 300; // 5 minutes

// Cache key prefixes
const TEAM_CACHE_PREFIX = 'team';
const LEADERBOARD_CACHE_PREFIX = 'leaderboard';

/**
 * Enhanced service class implementing team management business logic
 * with security, performance, and audit features
 */
@Injectable()
export class TeamService {
  private readonly logger: Logger;

  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly cacheService: CacheService
  ) {
    this.logger = new Logger(TeamService.name);
  }

  /**
   * Creates a new team with enhanced validation and audit logging
   * @param createTeamDto - Team creation data transfer object
   * @returns Promise resolving to newly created team
   */
  @Transaction()
  async createTeam(createTeamDto: {
    name: string;
    organizationId: string;
    maxMembers: number;
    createdBy: string;
  }): Promise<TeamEntity> {
    this.logger.debug(
      `Creating team: ${createTeamDto.name} for organization: ${createTeamDto.organizationId}`
    );

    try {
      // Create new team entity with validation
      const team = new TeamEntity(
        createTeamDto.name,
        createTeamDto.organizationId,
        createTeamDto.maxMembers
      );

      // Save team to database within transaction
      const savedTeam = await this.teamRepository.save(team);

      // Invalidate relevant cache entries
      await this.cacheService.delete(
        `${TEAM_CACHE_PREFIX}:${createTeamDto.organizationId}`,
        createTeamDto.organizationId
      );

      this.logger.log(
        `Team created successfully: ${savedTeam.id}`,
        { teamId: savedTeam.id, organizationId: createTeamDto.organizationId }
      );

      return savedTeam;
    } catch (error) {
      this.logger.error(
        `Failed to create team: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Updates team points with AI detection and transaction management
   * @param teamId - UUID of team to update
   * @param pointDelta - Points to add/subtract
   * @param isAIGenerated - Whether the activity was AI-generated
   * @returns Promise resolving to updated team
   */
  @Transaction()
  async updateTeamPoints(
    teamId: string,
    pointDelta: number,
    isAIGenerated: boolean
  ): Promise<TeamEntity> {
    this.logger.debug(
      `Updating team points: ${teamId}, delta: ${pointDelta}, AI: ${isAIGenerated}`
    );

    try {
      // Update points within transaction
      const updatedTeam = await this.teamRepository.updateTeamPoints(
        teamId,
        pointDelta,
        isAIGenerated
      );

      // Invalidate team and leaderboard caches
      await Promise.all([
        this.cacheService.delete(
          `${TEAM_CACHE_PREFIX}:${teamId}`,
          updatedTeam.organizationId
        ),
        this.cacheService.delete(
          `${LEADERBOARD_CACHE_PREFIX}:${updatedTeam.organizationId}`,
          updatedTeam.organizationId
        )
      ]);

      this.logger.log(
        `Team points updated successfully: ${teamId}`,
        { teamId, pointDelta, isAIGenerated, newTotal: updatedTeam.totalPoints }
      );

      return updatedTeam;
    } catch (error) {
      this.logger.error(
        `Failed to update team points: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Retrieves cached team leaderboard with pagination
   * @param organizationId - UUID of organization
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated team leaderboard
   */
  async getTeamLeaderboard(
    organizationId: string,
    pagination: { page: number; limit: number }
  ): Promise<{
    teams: TeamEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const cacheKey = `${LEADERBOARD_CACHE_PREFIX}:${organizationId}:${pagination.page}:${pagination.limit}`;

    try {
      // Check cache first
      const cachedLeaderboard = await this.cacheService.get(
        cacheKey,
        organizationId,
        { ttl: LEADERBOARD_CACHE_TTL }
      );

      if (cachedLeaderboard) {
        this.logger.debug('Returning cached leaderboard');
        return cachedLeaderboard;
      }

      // Query database if cache miss
      const teams = await this.teamRepository.findByOrganizationId(
        organizationId
      );

      const startIndex = (pagination.page - 1) * pagination.limit;
      const paginatedTeams = teams.slice(
        startIndex,
        startIndex + pagination.limit
      );

      const leaderboard = {
        teams: paginatedTeams,
        total: teams.length,
        page: pagination.page,
        limit: pagination.limit
      };

      // Update cache
      await this.cacheService.set(
        cacheKey,
        leaderboard,
        organizationId,
        { ttl: LEADERBOARD_CACHE_TTL }
      );

      this.logger.debug(
        `Retrieved leaderboard for organization: ${organizationId}`
      );

      return leaderboard;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve team leaderboard: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Retrieves team point configuration with AI modifiers
   * @param teamId - UUID of team
   * @returns Promise resolving to team's point configuration
   */
  async getTeamPointConfig(teamId: string): Promise<TenantConfig['pointConfig']> {
    try {
      const config = await this.teamRepository.getTeamPointConfig(teamId);
      this.logger.debug(`Retrieved point config for team: ${teamId}`);
      return config;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve team point config: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}