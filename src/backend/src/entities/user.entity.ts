/**
 * @fileoverview User entity class for CodeQuest platform implementing comprehensive user management
 * with TypeORM, role-based access control, SSO integration, and audit trails.
 * @version 1.0.0
 */

import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index 
} from 'typeorm'; // ^0.3.0
import { ROLES, isValidRole } from '../constants/roles.constants';

/**
 * Interface defining the structure of SSO data stored for each user
 */
interface SSOData {
  provider: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  profile?: {
    name?: string;
    picture?: string;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

/**
 * User entity representing a user in the CodeQuest platform
 * Implements comprehensive user management with role-based access control and SSO integration
 */
@Entity('users')
@Index(['email'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email: string;

  @Column({ 
    type: 'enum', 
    enum: ROLES, 
    default: ROLES.GENERAL_USER 
  })
  role: ROLES;

  @Column({ 
    type: 'jsonb', 
    nullable: true, 
    name: 'sso_data' 
  })
  ssoData: SSOData;

  @Column({ 
    type: 'boolean', 
    default: true, 
    name: 'is_active' 
  })
  isActive: boolean;

  @Column({ 
    type: 'timestamp with time zone', 
    nullable: true, 
    name: 'last_login_at' 
  })
  lastLoginAt: Date | null;

  @CreateDateColumn({ 
    type: 'timestamp with time zone', 
    name: 'created_at' 
  })
  createdAt: Date;

  @UpdateDateColumn({ 
    type: 'timestamp with time zone', 
    name: 'updated_at' 
  })
  updatedAt: Date;

  /**
   * Creates a new user entity with validation
   * @param email - User's email address
   * @param role - User's initial role
   * @throws Error if email format is invalid or role is not recognized
   */
  constructor(email: string, role: ROLES = ROLES.GENERAL_USER) {
    if (!email || !this.validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    if (!isValidRole(role)) {
      throw new Error('Invalid role specified');
    }

    this.email = email.toLowerCase();
    this.role = role;
    this.isActive = true;
    this.ssoData = {} as SSOData;
    this.createdAt = new Date();
    this.lastLoginAt = null;
  }

  /**
   * Updates SSO authentication data with validation
   * @param ssoData - New SSO data to store
   * @throws Error if SSO data is invalid or missing required fields
   */
  updateSSOData(ssoData: SSOData): void {
    if (!ssoData.provider || !ssoData.providerId) {
      throw new Error('Invalid SSO data: provider and providerId are required');
    }

    this.ssoData = {
      ...ssoData,
      metadata: {
        ...ssoData.metadata,
        lastUpdated: new Date().toISOString()
      }
    };
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Updates user role with validation against ROLES enum
   * @param newRole - New role to assign to user
   * @throws Error if role is invalid or transition is not allowed
   */
  updateRole(newRole: ROLES): void {
    if (!isValidRole(newRole)) {
      throw new Error('Invalid role specified');
    }

    // Prevent role change for deactivated users
    if (!this.isActive) {
      throw new Error('Cannot update role for inactive user');
    }

    this.role = newRole;
    this.updatedAt = new Date();
  }

  /**
   * Safely deactivates user account and clears sensitive data
   * @throws Error if user is already deactivated
   */
  deactivate(): void {
    if (!this.isActive) {
      throw new Error('User is already deactivated');
    }

    this.isActive = false;
    // Clear sensitive SSO data while preserving provider info for audit
    this.ssoData = {
      provider: this.ssoData.provider,
      providerId: this.ssoData.providerId,
      metadata: {
        deactivatedAt: new Date().toISOString(),
        previousProvider: this.ssoData.provider
      }
    };
    this.updatedAt = new Date();
  }

  /**
   * Validates email format using RFC 5322 standard
   * @param email - Email to validate
   * @returns Boolean indicating if email is valid
   * @private
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }
}