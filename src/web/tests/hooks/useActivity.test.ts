/**
 * @fileoverview Comprehensive test suite for useActivity hook
 * Tests activity tracking, real-time updates, point calculations, and tenant isolation
 * @version 1.0.0
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Internal imports
import { useActivity } from '../../src/hooks/useActivity';
import { WebSocketService } from '../../src/services/websocket.service';
import { Activity, ActivityType } from '../../src/types/activity.types';
import activitySlice from '../../src/store/activity.slice';
import tenantSlice from '../../src/store/tenant.slice';

// Test constants
const TEST_TIMEOUT = 3000;
const TEST_TENANT_ID = 'test-tenant-123';
const TEST_TEAM_ID = 'test-team-123';

// Mock services
jest.mock('../../src/services/websocket.service');
jest.mock('../../src/services/activity.service');

/**
 * Creates a mock activity with tenant isolation
 */
const mockActivity = (overrides?: Partial<Activity>): Activity => ({
  id: crypto.randomUUID(),
  type: ActivityType.CODE_CHECKIN,
  teamMemberId: 'test-member-123',
  points: 10,
  isAiGenerated: false,
  tenantId: TEST_TENANT_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {
    adoId: 'ado-123',
    repository: 'test-repo',
    url: 'https://dev.azure.com/test',
    title: 'Test Activity'
  },
  ...overrides
});

/**
 * Test setup utility with mocked services and tenant context
 */
const setupTest = (options?: { tenantId?: string; autoRefresh?: boolean }) => {
  // Configure test store
  const store = configureStore({
    reducer: {
      activity: activitySlice.reducer,
      tenant: tenantSlice.reducer
    },
    preloadedState: {
      tenant: {
        currentTenantId: options?.tenantId || TEST_TENANT_ID
      }
    }
  });

  // Create wrapper with store provider
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper,
    render: (hookOptions = {}) =>
      renderHook(
        () =>
          useActivity({
            tenantId: options?.tenantId || TEST_TENANT_ID,
            autoRefresh: options?.autoRefresh ?? true,
            wsEnabled: true,
            ...hookOptions
          }),
        { wrapper }
      )
  };
};

describe('useActivity Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should fetch activities for current tenant only', async () => {
    // Setup
    const { render } = setupTest();
    const mockActivities = [
      mockActivity({ tenantId: TEST_TENANT_ID }),
      mockActivity({ tenantId: 'other-tenant' })
    ];

    // Mock activity service response
    const mockActivityService = jest.mocked(WebSocketService);
    mockActivityService.prototype.connect.mockResolvedValue();

    // Render hook
    const { result } = render();

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.activities).toHaveLength(1);
      expect(result.current.activities[0].tenantId).toBe(TEST_TENANT_ID);
    });
  });

  it('should receive real-time updates within 2 seconds', async () => {
    // Setup with WebSocket enabled
    const { render } = setupTest({ autoRefresh: true });
    const newActivity = mockActivity();

    // Mock WebSocket service
    const mockWsService = jest.mocked(WebSocketService);
    mockWsService.prototype.connect.mockResolvedValue();

    // Render hook
    const { result } = render();

    // Simulate WebSocket message
    await act(async () => {
      const wsCallback = mockWsService.prototype.subscribe.mock.calls[0][1];
      wsCallback(newActivity);
    });

    // Verify real-time update
    await waitFor(
      () => {
        expect(result.current.activities).toContainEqual(
          expect.objectContaining({
            id: newActivity.id,
            tenantId: TEST_TENANT_ID
          })
        );
      },
      { timeout: 2000 }
    );
  });

  it('should calculate points with AI detection', async () => {
    // Setup
    const { render } = setupTest();
    const aiActivity = mockActivity({
      isAiGenerated: true,
      type: ActivityType.PULL_REQUEST
    });

    // Render hook
    const { result } = render();

    // Calculate points
    const points = result.current.calculatePoints(aiActivity);

    // Verify AI point modification
    expect(points).toBe(Math.round(25 * 0.75)); // 25 base points * 0.75 AI modifier
  });

  it('should handle WebSocket reconnection', async () => {
    // Setup
    const { render } = setupTest();
    const mockWsService = jest.mocked(WebSocketService);

    // Render hook
    const { result } = render();

    // Simulate disconnect
    await act(async () => {
      mockWsService.prototype.disconnect.mockImplementation(() => {
        mockWsService.prototype.connect.mockResolvedValueOnce();
      });
    });

    // Verify reconnection attempt
    expect(mockWsService.prototype.connect).toHaveBeenCalled();
  });

  it('should cleanup WebSocket connection on unmount', async () => {
    // Setup
    const { render } = setupTest();
    const mockWsService = jest.mocked(WebSocketService);

    // Render and unmount hook
    const { unmount } = render();
    unmount();

    // Verify cleanup
    expect(mockWsService.prototype.disconnect).toHaveBeenCalled();
  });

  it('should handle tenant switching', async () => {
    // Setup
    const initialTenant = TEST_TENANT_ID;
    const newTenant = 'new-tenant-123';
    const { render } = setupTest({ tenantId: initialTenant });

    // Render hook with initial tenant
    const { rerender } = render();

    // Switch tenant
    await act(async () => {
      rerender({
        tenantId: newTenant,
        autoRefresh: true,
        wsEnabled: true
      });
    });

    // Verify tenant switch
    await waitFor(() => {
      expect(result.current.activities.every(a => a.tenantId === newTenant)).toBe(
        true
      );
    });
  });
});