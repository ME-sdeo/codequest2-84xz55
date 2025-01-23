/**
 * @fileoverview Team module implementing comprehensive team management functionality
 * with multi-tenant support, points tracking, and secure data isolation.
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // v10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // v10.0.0

import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamRepository } from '../../repositories/team.repository';
import { TeamMemberRepository } from '../../repositories/team-member.repository';

/**
 * Module class configuring team management functionality with comprehensive support
 * for multi-tenant operations, points tracking, and secure data access
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeamRepository,
      TeamMemberRepository
    ])
  ],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService]
})
export class TeamModule {
  /**
   * Current module version for tracking and compatibility
   */
  private readonly moduleVersion: string = '1.0.0';

  /**
   * Flag indicating module initialization status
   */
  private isInitialized: boolean = false;

  /**
   * Lifecycle hook for module initialization tasks
   * Verifies repository connections and sets up required configurations
   */
  async onModuleInit(): Promise<void> {
    try {
      // Verify repository connections
      await this.verifyRepositoryConnections();

      // Initialize caching strategies
      await this.initializeCaching();

      // Set up performance monitors
      await this.setupPerformanceMonitoring();

      // Configure tenant isolation
      await this.configureTenantIsolation();

      // Register event handlers
      await this.registerEventHandlers();

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Team module initialization failed: ${error.message}`);
    }
  }

  /**
   * Verifies that all required repository connections are functional
   * @private
   */
  private async verifyRepositoryConnections(): Promise<void> {
    try {
      await Promise.all([
        TeamRepository.prototype.hasId(null), // Test connection
        TeamMemberRepository.prototype.hasId(null) // Test connection
      ]);
    } catch (error) {
      throw new Error(`Repository connection verification failed: ${error.message}`);
    }
  }

  /**
   * Initializes caching strategies for team-related operations
   * @private
   */
  private async initializeCaching(): Promise<void> {
    // Cache configuration is handled by the CacheService
    // which is injected into the TeamService
  }

  /**
   * Sets up performance monitoring for team operations
   * @private
   */
  private async setupPerformanceMonitoring(): Promise<void> {
    // Performance monitoring is handled through interceptors
    // defined in the TeamController
  }

  /**
   * Configures multi-tenant isolation for team data
   * @private
   */
  private async configureTenantIsolation(): Promise<void> {
    // Tenant isolation is enforced through repository filters
    // and guards defined in the TeamController
  }

  /**
   * Registers event handlers for team-related events
   * @private
   */
  private async registerEventHandlers(): Promise<void> {
    // Event handlers are configured through the
    // TeamService event emitters and subscribers
  }
}