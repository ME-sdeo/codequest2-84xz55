/**
 * @fileoverview Enhanced service layer for managing Azure DevOps activities in the frontend
 * Implements real-time activity tracking, caching, and point calculations with AI detection
 * @version 1.0.0
 */

// External imports
import retry from 'axios-retry'; // v3.5.0

// Internal imports
import { Activity, ActivityType } from '../types/activity.types';
import { getActivities } from '../api/activity.api';
import { 
  ACTIVITY_DISPLAY_CONFIG, 
  BASE_POINTS, 
  AI_POINT_MODIFIER 
} from '../constants/activity.constants';
import { WebSocketService } from '../services/websocket.service';

// Cache invalidation timeout (2 seconds per spec)
const CACHE_INVALIDATION_TIMEOUT = 2000;

/**
 * Enhanced service class for managing activities with AI detection and real-time updates
 */
export class ActivityService {
  private activityCache: Map<string, Activity[]>;
  private readonly wsService: WebSocketService;
  private cacheInvalidationTimer?: NodeJS.Timeout;

  /**
   * Initialize activity service with WebSocket support and caching
   * @param wsService WebSocket service instance for real-time updates
   */
  constructor(wsService: WebSocketService) {
    this.activityCache = new Map();
    this.wsService = wsService;

    // Set up real-time activity updates
    this.wsService.subscribe('activity.new', this.handleNewActivity.bind(this));
    this.wsService.subscribe('activity.update', this.handleActivityUpdate.bind(this));

    // Configure retry logic for API calls
    retry(getActivities, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 1000,
      retryCondition: (error) => {
        return retry.isNetworkOrIdempotentRequestError(error);
      }
    });
  }

  /**
   * Fetch activities with tenant isolation and caching
   * @param params Query parameters for activity fetch
   * @returns Promise resolving to activity list
   */
  public async fetchActivities(params: {
    page: number;
    limit: number;
    teamId?: string;
    userId?: string;
    tenantId: string;
  }): Promise<Activity[]> {
    const { tenantId, ...queryParams } = params;

    // Validate tenant context
    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    // Generate cache key with tenant isolation
    const cacheKey = this.generateCacheKey(params);

    // Check cache first
    const cachedActivities = this.activityCache.get(cacheKey);
    if (cachedActivities) {
      return cachedActivities;
    }

    try {
      // Fetch activities from API
      const response = await getActivities({
        ...queryParams,
        tenantId
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      // Transform activities with display config
      const transformedActivities = response.data.map(activity => ({
        ...activity,
        displayConfig: ACTIVITY_DISPLAY_CONFIG[activity.type],
        points: this.calculatePoints(
          activity.type,
          activity.isAiGenerated,
          tenantId
        )
      }));

      // Update cache
      this.activityCache.set(cacheKey, transformedActivities);
      this.setCacheInvalidationTimer(cacheKey);

      return transformedActivities;
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }
  }

  /**
   * Calculate points for activity with AI detection support
   * @param activityType Type of activity
   * @param isAiGenerated Whether activity is AI-generated
   * @param tenantId Tenant identifier for org-specific overrides
   * @returns Calculated points
   */
  public calculatePoints(
    activityType: ActivityType,
    isAiGenerated: boolean,
    tenantId: string
  ): number {
    // Get base points for activity type
    const basePoints = BASE_POINTS[activityType];
    if (!basePoints) {
      throw new Error(`Invalid activity type: ${activityType}`);
    }

    // Apply AI modifier if detected
    let points = isAiGenerated 
      ? basePoints * AI_POINT_MODIFIER.MULTIPLIER 
      : basePoints;

    // Round to nearest integer
    points = Math.round(points);

    // Validate final point value
    if (points < 0) {
      throw new Error('Invalid point calculation');
    }

    return points;
  }

  /**
   * Handle new activity from WebSocket
   * @private
   * @param activity New activity data
   */
  private handleNewActivity(activity: Activity): void {
    // Invalidate affected cache entries
    const affectedKeys = Array.from(this.activityCache.keys())
      .filter(key => key.includes(activity.tenantId));

    affectedKeys.forEach(key => {
      const activities = this.activityCache.get(key);
      if (activities) {
        activities.unshift({
          ...activity,
          displayConfig: ACTIVITY_DISPLAY_CONFIG[activity.type],
          points: this.calculatePoints(
            activity.type,
            activity.isAiGenerated,
            activity.tenantId
          )
        });
        this.activityCache.set(key, activities);
      }
    });
  }

  /**
   * Handle activity update from WebSocket
   * @private
   * @param updatedActivity Updated activity data
   */
  private handleActivityUpdate(updatedActivity: Activity): void {
    // Update affected cache entries
    Array.from(this.activityCache.entries()).forEach(([key, activities]) => {
      const index = activities.findIndex(a => a.id === updatedActivity.id);
      if (index !== -1) {
        activities[index] = {
          ...updatedActivity,
          displayConfig: ACTIVITY_DISPLAY_CONFIG[updatedActivity.type],
          points: this.calculatePoints(
            updatedActivity.type,
            updatedActivity.isAiGenerated,
            updatedActivity.tenantId
          )
        };
        this.activityCache.set(key, activities);
      }
    });
  }

  /**
   * Generate cache key with tenant isolation
   * @private
   * @param params Query parameters
   * @returns Cache key string
   */
  private generateCacheKey(params: {
    page: number;
    limit: number;
    teamId?: string;
    userId?: string;
    tenantId: string;
  }): string {
    return `${params.tenantId}:${params.teamId || ''}:${params.userId || ''}:${params.page}:${params.limit}`;
  }

  /**
   * Set cache invalidation timer
   * @private
   * @param cacheKey Cache key to invalidate
   */
  private setCacheInvalidationTimer(cacheKey: string): void {
    if (this.cacheInvalidationTimer) {
      clearTimeout(this.cacheInvalidationTimer);
    }

    this.cacheInvalidationTimer = setTimeout(() => {
      this.activityCache.delete(cacheKey);
    }, CACHE_INVALIDATION_TIMEOUT);
  }

  /**
   * Clear activity cache
   * @public
   */
  public clearCache(): void {
    this.activityCache.clear();
    if (this.cacheInvalidationTimer) {
      clearTimeout(this.cacheInvalidationTimer);
    }
  }
}