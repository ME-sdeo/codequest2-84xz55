/**
 * @fileoverview Comprehensive test suite for useTeam custom hook
 * Testing team management, real-time updates, points system, and multi-tenant architecture
 * @version 1.0.0
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { performance } from 'perf_hooks';
import { TenantContext } from '@company/tenant-context';

import { useTeam } from '../../src/hooks/useTeam';
import { teamService } from '../../src/services/team.service';
import type { Team, TeamError } from '../../src/types/team.types';

// Mock the team service
jest.mock('../../src/services/team.service');

// Test data constants
const MOCK_TENANT_ID = 'tenant-1';
const MOCK_COMPANY_ID = 'company-1';
const UPDATE_SLA_MS = 2000; // 2 seconds as per technical specs

const mockTeams: Team[] = [
  {
    id: 'team-1',
    name: 'Frontend Team',
    totalPoints: 1000,
    memberCount: 5,
    members: [],
    isActive: true,
    lastActivityAt: new Date(),
    version: '1',
    metadata: {},
    companyId: MOCK_COMPANY_ID,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'team-2',
    name: 'Backend Team',
    totalPoints: 2000,
    memberCount: 8,
    members: [],
    isActive: true,
    lastActivityAt: new Date(),
    version: '1',
    metadata: {},
    companyId: MOCK_COMPANY_ID,
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

describe('useTeam Hook', () => {
  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock successful team service responses
    (teamService.getTeams as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        data: mockTeams,
        total: mockTeams.length,
        page: 1,
        pageSize: 10
      }
    });

    (teamService.getTeamById as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        team: mockTeams[0],
        stats: {
          totalPoints: 1000,
          averagePoints: 200,
          activeMembers: 5,
          topLevel: 10,
          weeklyPoints: 100,
          monthlyPoints: 400,
          achievementCount: 15,
          customMetrics: {}
        },
        errors: []
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should validate tenant isolation', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantContext.Provider value={{ tenantId: MOCK_TENANT_ID }}>
        {children}
      </TenantContext.Provider>
    );

    const { result } = renderHook(() => useTeam({
      tenantId: MOCK_TENANT_ID,
      page: 1,
      limit: 10
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(teamService.getTeams).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: MOCK_TENANT_ID })
    );
    expect(result.current.teams).toEqual(mockTeams);
  });

  it('should measure real-time updates within SLA', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantContext.Provider value={{ tenantId: MOCK_TENANT_ID }}>
        {children}
      </TenantContext.Provider>
    );

    const { result } = renderHook(() => useTeam({
      tenantId: MOCK_TENANT_ID,
      teamId: 'team-1'
    }), { wrapper });

    const startTime = performance.now();

    // Simulate team update
    await act(async () => {
      const updatedTeam = { ...mockTeams[0], totalPoints: 1500 };
      (teamService.updateTeam as jest.Mock).mockResolvedValue({
        success: true,
        data: updatedTeam
      });

      await result.current.updateTeam('team-1', { name: 'Updated Frontend Team' });
    });

    const updateTime = performance.now() - startTime;
    expect(updateTime).toBeLessThan(UPDATE_SLA_MS);
    expect(result.current.currentTeam?.totalPoints).toBe(1500);
  });

  it('should handle points system updates correctly', async () => {
    const { result } = renderHook(() => useTeam({
      tenantId: MOCK_TENANT_ID,
      teamId: 'team-1'
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.currentTeam?.totalPoints).toBe(1000);

    // Simulate points update
    await act(async () => {
      const updatedTeam = { ...mockTeams[0], totalPoints: 1200 };
      (teamService.getTeamById as jest.Mock).mockResolvedValue({
        success: true,
        data: { team: updatedTeam, stats: { totalPoints: 1200 }, errors: [] }
      });

      await result.current.refreshTeams();
    });

    expect(result.current.currentTeam?.totalPoints).toBe(1200);
  });

  it('should handle error states appropriately', async () => {
    const mockError: TeamError = {
      code: 'FETCH_ERROR',
      message: 'Failed to fetch teams',
      field: '',
      details: null
    };

    (teamService.getTeams as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useTeam({
      tenantId: MOCK_TENANT_ID
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(mockError);
    expect(result.current.teams).toEqual([]);
  });

  it('should maintain tenant isolation during updates', async () => {
    const differentTenantId = 'tenant-2';
    
    const { result, rerender } = renderHook(
      (props) => useTeam(props),
      {
        initialProps: { tenantId: MOCK_TENANT_ID }
      }
    );

    await waitFor(() => {
      expect(result.current.teams).toEqual(mockTeams);
    });

    // Attempt to switch tenant
    rerender({ tenantId: differentTenantId });

    expect(teamService.getTeams).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: differentTenantId })
    );
    expect(result.current.teams).not.toEqual(mockTeams);
  });

  it('should cleanup subscriptions on unmount', async () => {
    const { result, unmount } = renderHook(() => useTeam({
      tenantId: MOCK_TENANT_ID
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    expect(result.current.subscription?.closed).toBe(true);
  });
});