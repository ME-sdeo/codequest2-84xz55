/**
 * @fileoverview Enhanced team repository for managing team entities with real-time point tracking
 * and multi-tenant isolation in the CodeQuest platform
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // v10.0.0
import { 
  Repository, 
  EntityRepository, 
  EntityManager, 
  QueryRunner 
} from 'typeorm'; // v0.3.0
import { AuditLogger } from '@nestjs/common'; // v10.0.0

import { TeamEntity } from '../entities/team.entity';
import { TenantConfig } from '../interfaces/tenant.interface';

/**
 * Repository class for handling team-related database operations
 * Implements multi-tenant data access patterns and real-time point tracking
 */
@Injectable()
@EntityRepository(TeamEntity)
export class TeamRepository extends Repository<TeamEntity> {
  private readonly manager: EntityManager;
  private readonly auditLogger: AuditLogger;

  constructor(
    manager: EntityManager,
    auditLogger: AuditLogger
  ) {
    super();
    this.manager = manager;
    this.auditLogger = auditLogger;
  }

  /**
   * Finds all teams belonging to an organization with enhanced member and point tracking
   * @param organizationId - UUID of the organization
   * @returns Promise resolving to array of team entities with member counts and point totals
   */
  async findByOrganizationId(organizationId: string): Promise<TeamEntity[]> {
    const queryBuilder = this.createQueryBuilder('team')
      .leftJoinAndSelect('team.organization', 'organization')
      .where('team.organizationId = :organizationId', { organizationId })
      .andWhere('team.deletedAt IS NULL')
      .select([
        'team.id',
        'team.name',
        'team.totalPoints',
        'team.memberCount',
        'team.aiGeneratedPoints',
        'team.standardPoints',
        'team.maxMembers',
        'team.createdAt',
        'team.updatedAt'
      ])
      .orderBy('team.totalPoints', 'DESC');

    try {
      const teams = await queryBuilder.getMany();
      this.auditLogger.log(`Retrieved ${teams.length} teams for organization ${organizationId}`);
      return teams;
    } catch (error) {
      this.auditLogger.error(
        `Error retrieving teams for organization ${organizationId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Updates a team's total points with real-time processing and AI detection
   * @param teamId - UUID of the team
   * @param pointDelta - Points to add/subtract
   * @param isAIGenerated - Whether the activity was AI-generated
   * @returns Promise resolving to updated team entity
   */
  async updateTeamPoints(
    teamId: string,
    pointDelta: number,
    isAIGenerated: boolean
  ): Promise<TeamEntity> {
    const queryRunner: QueryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const team = await queryRunner.manager.findOne(TeamEntity, {
        where: { id: teamId, deletedAt: null },
        relations: ['organization']
      });

      if (!team) {
        throw new Error(`Team ${teamId} not found or is deleted`);
      }

      const updatedPoints = await team.updateTotalPoints(pointDelta, isAIGenerated);

      await queryRunner.manager.save(team);

      this.auditLogger.log(
        `Updated points for team ${teamId}: ${pointDelta} points (AI: ${isAIGenerated})`
      );

      await queryRunner.commitTransaction();
      return team;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.auditLogger.error(
        `Error updating points for team ${teamId}: ${error.message}`
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Retrieves the point configuration for a team with AI modifiers
   * @param teamId - UUID of the team
   * @returns Promise resolving to team's point configuration with AI modifiers
   */
  async getTeamPointConfig(teamId: string): Promise<TenantConfig['pointConfig']> {
    try {
      const team = await this.findOne({
        where: { id: teamId, deletedAt: null },
        relations: ['organization', 'organization.company']
      });

      if (!team) {
        throw new Error(`Team ${teamId} not found or is deleted`);
      }

      const pointConfig = await team.getPointConfig();
      
      this.auditLogger.log(`Retrieved point config for team ${teamId}`);
      return pointConfig;
    } catch (error) {
      this.auditLogger.error(
        `Error retrieving point config for team ${teamId}: ${error.message}`
      );
      throw error;
    }
  }
}