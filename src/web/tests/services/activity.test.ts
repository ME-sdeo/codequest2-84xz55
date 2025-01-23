/**
 * @fileoverview Test suite for ActivityService class covering activity tracking,
 * real-time updates, point calculations, and multi-tenant functionality
 * @version 1.0.0
 */

import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import type { MockInstance } from 'jest-mock';
import { performance } from 'perf_hooks';

// Internal imports
import { ActivityService } from '../../src/services/activity.service';
import { WebSocketService } from '../../src/services/websocket.service';
import { Activity, ActivityType } from '../../src/types/activity.types';
import { BASE_POINTS, AI_POINT_MODIFIER } from '../../src/constants/activity.constants';

// Mock WebSocket service
jest.mock('../../src/services/websocket.service');

// Test constants
const TEST_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_TEAM_ID = '7c4f1143-a8e8-4987-a487-1234567890ab';
const TEST_USER_ID = 'a1b2c3d4-e5f6-4321-a987-123456789abc';
const RESPONSE_TIME_SLA = 500; // 500ms SLA per spec

describe('ActivityService', () => {
  let activityService: ActivityService;
  let webSocketService: jest.Mocked<WebSocketService>;
  let mockSubscribe: MockInstance;
  let mockUnsubscribe: MockInstance;

  // Sample activity data
  const mockActivity: Activity = {
    id: '123',
    type: ActivityType.CODE_REVIEW,
    teamMemberId: TEST_USER_ID,
    points: 15,
    isAiGenerated: false,
    tenantId: TEST_TENANT_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      adoId: 'ADO-123',
      repository: 'test-repo',
      url: 'https://dev.azure.com/test',
      title: 'Test Activity'
    }
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Initialize WebSocket mock
    webSocketService = new WebSocketService({
      url: 'wss://test.com'
    }) as jest.Mocked<WebSocketService>;

    mockSubscribe = jest.fn();
    mockUnsubscribe = jest.fn();

    webSocketService.subscribe = mockSubscribe;
    webSocketService.unsubscribe = mockUnsubscribe;

    // Initialize ActivityService
    activityService = new ActivityService(webSocketService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    activityService.clearCache();
  });

  describe('Activity Fetching', () => {
    test('should fetch activities with tenant isolation', async () => {
      const startTime = performance.now();

      const activities = await activityService.fetchActivities({
        page: 1,
        limit: 10,
        tenantId: TEST_TENANT_ID
      });

      const responseTime = performance.now() - startTime;

      expect(activities).toBeDefined();
      expect(responseTime).toBeLessThan(RESPONSE_TIME_SLA);
      expect(activities.every(a => a.tenantId === TEST_TENANT_ID)).toBe(true);
    });

    test('should handle pagination correctly', async () => {
      const page1 = await activityService.fetchActivities({
        page: 1,
        limit: 5,
        tenantId: TEST_TENANT_ID
      });

      const page2 = await activityService.fetchActivities({
        page: 2,
        limit: 5,
        tenantId: TEST_TENANT_ID
      });

      expect(page1).toHaveLength(5);
      expect(page2).toHaveLength(5);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    test('should throw error without tenant context', async () => {
      await expect(
        activityService.fetchActivities({
          page: 1,
          limit: 10,
          tenantId: ''
        })
      ).rejects.toThrow('Tenant context required');
    });

    test('should cache activities and invalidate after timeout', async () => {
      const firstCall = await activityService.fetchActivities({
        page: 1,
        limit: 10,
        tenantId: TEST_TENANT_ID
      });

      const secondCall = await activityService.fetchActivities({
        page: 1,
        limit: 10,
        tenantId: TEST_TENANT_ID
      });

      expect(secondCall).toBe(firstCall); // Should return cached result

      jest.advanceTimersByTime(2000); // Cache invalidation timeout

      const thirdCall = await activityService.fetchActivities({
        page: 1,
        limit: 10,
        tenantId: TEST_TENANT_ID
      });

      expect(thirdCall).not.toBe(firstCall); // Should fetch new data
    });
  });

  describe('Real-time Updates', () => {
    test('should receive activity updates within SLA', done => {
      const startTime = performance.now();

      activityService.subscribeToUpdates((activity: Activity) => {
        const updateTime = performance.now() - startTime;
        expect(updateTime).toBeLessThan(2000); // 2 second SLA per spec
        expect(activity).toBeDefined();
        done();
      });

      webSocketService.emit('activity.new', mockActivity);
    });

    test('should handle WebSocket reconnection', () => {
      const mockReconnect = jest.fn();
      webSocketService.connect = mockReconnect;

      webSocketService.emit('close', {});
      webSocketService.emit('open', {});

      expect(mockSubscribe).toHaveBeenCalledTimes(2);
      expect(mockReconnect).toHaveBeenCalled();
    });

    test('should update cache on real-time events', async () => {
      await activityService.fetchActivities({
        page: 1,
        limit: 10,
        tenantId: TEST_TENANT_ID
      });

      const newActivity = { ...mockActivity, id: '456' };
      webSocketService.emit('activity.new', newActivity);

      const activities = await activityService.fetchActivities({
        page: 1,
        limit: 10,
        tenantId: TEST_TENANT_ID
      });

      expect(activities).toContainEqual(expect.objectContaining({ id: '456' }));
    });
  });

  describe('Point Calculations', () => {
    test('should calculate points correctly with AI detection', () => {
      // Regular activity points
      const regularPoints = activityService.calculatePoints(
        ActivityType.CODE_REVIEW,
        false,
        TEST_TENANT_ID
      );
      expect(regularPoints).toBe(BASE_POINTS[ActivityType.CODE_REVIEW]);

      // AI-generated activity points
      const aiPoints = activityService.calculatePoints(
        ActivityType.CODE_REVIEW,
        true,
        TEST_TENANT_ID
      );
      expect(aiPoints).toBe(
        Math.round(BASE_POINTS[ActivityType.CODE_REVIEW] * AI_POINT_MODIFIER.MULTIPLIER)
      );
    });

    test('should handle all activity types', () => {
      Object.values(ActivityType).forEach(type => {
        const points = activityService.calculatePoints(type, false, TEST_TENANT_ID);
        expect(points).toBe(BASE_POINTS[type]);
      });
    });

    test('should throw error for invalid activity type', () => {
      expect(() => {
        activityService.calculatePoints(
          'INVALID_TYPE' as ActivityType,
          false,
          TEST_TENANT_ID
        );
      }).toThrow('Invalid activity type');
    });

    test('should validate point boundaries', () => {
      const points = activityService.calculatePoints(
        ActivityType.STORY_CLOSURE,
        true,
        TEST_TENANT_ID
      );
      expect(points).toBeGreaterThan(0);
      expect(Number.isInteger(points)).toBe(true);
    });
  });

  describe('Multi-tenant Support', () => {
    test('should maintain tenant data isolation', async () => {
      const tenant1Activities = await activityService.fetchActivities({
        page: 1,
        limit: 10,
        tenantId: 'tenant1'
      });

      const tenant2Activities = await activityService.fetchActivities({
        page: 1,
        limit: 10,
        tenantId: 'tenant2'
      });

      expect(tenant1Activities.every(a => a.tenantId === 'tenant1')).toBe(true);
      expect(tenant2Activities.every(a => a.tenantId === 'tenant2')).toBe(true);
    });

    test('should handle tenant-specific WebSocket events', () => {
      const tenant1Handler = jest.fn();
      const tenant2Handler = jest.fn();

      activityService.subscribeToUpdates(tenant1Handler, 'tenant1');
      activityService.subscribeToUpdates(tenant2Handler, 'tenant2');

      webSocketService.emit('activity.new', { ...mockActivity, tenantId: 'tenant1' });
      expect(tenant1Handler).toHaveBeenCalled();
      expect(tenant2Handler).not.toHaveBeenCalled();
    });
  });
});