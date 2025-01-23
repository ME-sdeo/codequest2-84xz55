/**
 * @fileoverview Repository class for managing user data persistence and retrieval operations
 * with enhanced security, audit logging, and performance optimizations.
 * @version 1.0.0
 */

import { Repository, EntityRepository, FindOptionsWhere, QueryRunner } from 'typeorm'; // ^0.3.0
import { AuditLogger } from '@company/audit-logger'; // ^1.0.0
import { UserEntity } from '../entities/user.entity';
import { ROLES } from '../constants/roles.constants';

/**
 * Repository class for managing user data with security and audit logging
 */
@EntityRepository(UserEntity)
export class UserRepository extends Repository<UserEntity> {
  private readonly CACHE_TTL = 300; // 5 minutes cache duration
  private readonly BULK_BATCH_SIZE = 100;

  constructor(private readonly auditLogger: AuditLogger) {
    super();
  }

  /**
   * Finds a user by their email address with caching
   * @param email - User's email address
   * @returns Promise resolving to found user or null
   * @throws Error if email format is invalid
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    if (!email || !this.validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    const normalizedEmail = email.toLowerCase();
    const queryOptions: FindOptionsWhere<UserEntity> = { email: normalizedEmail };

    const user = await this.findOne({
      where: queryOptions,
      cache: {
        id: `user_email_${normalizedEmail}`,
        milliseconds: this.CACHE_TTL
      }
    });

    await this.auditLogger.log({
      action: 'USER_LOOKUP',
      target: normalizedEmail,
      success: !!user,
      metadata: { found: !!user }
    });

    return user;
  }

  /**
   * Finds multiple users by their IDs with bulk loading optimization
   * @param ids - Array of user IDs to find
   * @returns Promise resolving to array of found users
   * @throws Error if IDs array is invalid
   */
  async findByIds(ids: string[]): Promise<UserEntity[]> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Invalid IDs array');
    }

    // Deduplicate IDs
    const uniqueIds = [...new Set(ids)];

    // Process in batches for large arrays
    const results: UserEntity[] = [];
    for (let i = 0; i < uniqueIds.length; i += this.BULK_BATCH_SIZE) {
      const batchIds = uniqueIds.slice(i, i + this.BULK_BATCH_SIZE);
      const batchResults = await this.find({
        where: { id: { $in: batchIds } as any },
        cache: {
          id: `user_ids_${batchIds.join('_')}`,
          milliseconds: this.CACHE_TTL
        }
      });
      results.push(...batchResults);
    }

    await this.auditLogger.log({
      action: 'BULK_USER_LOOKUP',
      target: 'MULTIPLE_USERS',
      success: true,
      metadata: {
        requestedCount: ids.length,
        foundCount: results.length
      }
    });

    return results;
  }

  /**
   * Creates a new user with transaction support and validation
   * @param email - User's email address
   * @param role - User's role
   * @param ssoData - SSO authentication data
   * @returns Promise resolving to created user
   * @throws Error if validation fails or user already exists
   */
  async createUser(
    email: string,
    role: ROLES = ROLES.GENERAL_USER,
    ssoData?: Record<string, any>
  ): Promise<UserEntity> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check for existing user
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create and save new user
      const user = new UserEntity(email, role);
      if (ssoData) {
        user.updateSSOData(ssoData);
      }

      const savedUser = await queryRunner.manager.save(UserEntity, user);

      await this.auditLogger.log({
        action: 'USER_CREATION',
        target: email,
        success: true,
        metadata: {
          role,
          hasSSOData: !!ssoData
        }
      });

      await queryRunner.commitTransaction();
      return savedUser;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      await this.auditLogger.log({
        action: 'USER_CREATION',
        target: email,
        success: false,
        metadata: {
          error: error.message
        }
      });
      throw error;

    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validates email format using RFC 5322 standard
   * @param email - Email to validate
   * @returns Boolean indicating if email is valid
   * @private
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }
}