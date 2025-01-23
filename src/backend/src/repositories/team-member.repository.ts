/**
 * @fileoverview Team member repository implementing data access and persistence operations
 * with enhanced points tracking, tenant isolation, and real-time leaderboard functionality
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // ^10.0.0
import { Repository, EntityRepository, EntityManager } from 'typeorm'; // ^0.3.0
import { UseInterceptors } from '@nestjs/common'; // ^10.0.0
import { CacheInterceptor, CacheManager } from '@nestjs/cache-manager'; // ^1.0.0

import { TeamMemberEntity } from '../../entities/team-member.entity';
import { TeamEntity } from '../../entities/team.entity';
import { User } from '../../entities/user.entity';

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
  order?: 'ASC' | 'DESC';
}

/**
 * Interface for paginated leaderboard response
 */
interface PaginatedLeaderboard {
  items: TeamMemberEntity[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Interface for point modifiers
 */
interface PointModifiers {
  baseMultiplier?: number;
  aiModifier?: number;
  activityType: string;
}

/**
 * Repository class for managing team member data with enhanced points tracking
 */
@Injectable()
@EntityRepository(TeamMemberEntity)
@UseInterceptors(CacheInterceptor)
export class TeamMemberRepository extends Repository<TeamMemberEntity> {
  private readonly CACHE_TTL = 300; // 5 minutes cache
  private readonly LEADERBOARD_CACHE_PREFIX = 'leaderboard:';
  private readonly MEMBER_CACHE_PREFIX = 'team-member:';

  constructor(
    private readonly entityManager: EntityManager,
    private readonly cacheManager: CacheManager
  ) {
    super();
  }

  /**
   * Finds a team member by ID with tenant isolation
   * @param id - Team member ID
   * @param tenantId - Company tenant ID for isolation
   * @returns Promise resolving to team member if found
   * @throws Error if team member not found or tenant mismatch
   */
  async findById(id: string, tenantId: string): Promise<TeamMemberEntity> {
    const cacheKey = `${this.MEMBER_CACHE_PREFIX}${id}`;
    const cached = await this.cacheManager.get<TeamMemberEntity>(cacheKey);

    if (cached) {
      return cached;
    }

    const teamMember = await this.createQueryBuilder('teamMember')
      .leftJoinAndSelect('teamMember.team', 'team')
      .leftJoinAndSelect('team.organization', 'organization')
      .leftJoinAndSelect('organization.company', 'company')
      .where('teamMember.id = :id', { id })
      .andWhere('company.id = :tenantId', { tenantId })
      .getOne();

    if (!teamMember) {
      throw new Error('Team member not found or access denied');
    }

    await this.cacheManager.set(cacheKey, teamMember, this.CACHE_TTL);
    return teamMember;
  }

  /**
   * Updates team member points with AI detection support
   * @param id - Team member ID
   * @param points - Points to add
   * @param isAIGenerated - Whether activity was AI-generated
   * @param modifiers - Point calculation modifiers
   * @returns Promise resolving to updated team member
   */
  async updatePoints(
    id: string,
    points: number,
    isAIGenerated: boolean,
    modifiers: PointModifiers
  ): Promise<TeamMemberEntity> {
    return await this.entityManager.transaction(async transactionalEntityManager => {
      const teamMember = await transactionalEntityManager.findOne(TeamMemberEntity, {
        where: { id },
        relations: ['team']
      });

      if (!teamMember) {
        throw new Error('Team member not found');
      }

      // Apply point modifiers
      let finalPoints = points;
      if (modifiers.baseMultiplier) {
        finalPoints *= modifiers.baseMultiplier;
      }
      if (isAIGenerated && modifiers.aiModifier) {
        finalPoints *= modifiers.aiModifier;
      }

      // Update points and history
      await teamMember.addPoints(finalPoints, isAIGenerated, modifiers.activityType);
      
      // Invalidate caches
      await this.cacheManager.del(`${this.MEMBER_CACHE_PREFIX}${id}`);
      await this.cacheManager.del(`${this.LEADERBOARD_CACHE_PREFIX}${teamMember.teamId}`);

      return await transactionalEntityManager.save(TeamMemberEntity, teamMember);
    });
  }

  /**
   * Gets real-time team leaderboard with pagination
   * @param teamId - Team ID
   * @param options - Pagination options
   * @returns Promise resolving to paginated leaderboard
   */
  async getLeaderboard(
    teamId: string,
    options: PaginationOptions
  ): Promise<PaginatedLeaderboard> {
    const cacheKey = `${this.LEADERBOARD_CACHE_PREFIX}${teamId}:${options.page}:${options.limit}`;
    const cached = await this.cacheManager.get<PaginatedLeaderboard>(cacheKey);

    if (cached) {
      return cached;
    }

    const skip = (options.page - 1) * options.limit;
    const order = options.order || 'DESC';

    const [items, total] = await this.createQueryBuilder('teamMember')
      .leftJoinAndSelect('teamMember.user', 'user')
      .where('teamMember.teamId = :teamId', { teamId })
      .orderBy('teamMember.totalPoints', order)
      .skip(skip)
      .take(options.limit)
      .getManyAndCount();

    const result: PaginatedLeaderboard = {
      items,
      total,
      page: options.page,
      totalPages: Math.ceil(total / options.limit)
    };

    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * Validates team member access with tenant isolation
   * @param teamMemberId - Team member ID to validate
   * @param tenantId - Company tenant ID
   * @returns Promise resolving to boolean indicating access
   */
  private async validateAccess(
    teamMemberId: string,
    tenantId: string
  ): Promise<boolean> {
    const count = await this.createQueryBuilder('teamMember')
      .leftJoin('teamMember.team', 'team')
      .leftJoin('team.organization', 'organization')
      .leftJoin('organization.company', 'company')
      .where('teamMember.id = :teamMemberId', { teamMemberId })
      .andWhere('company.id = :tenantId', { tenantId })
      .getCount();

    return count > 0;
  }
}