/**
 * @fileoverview Comprehensive test suite for the team service
 * Validates team management functionality, points system, real-time updates,
 * and performance requirements including CRUD operations, member management,
 * state handling, caching behavior, and multi-tenant isolation
 * @version 1.0.0
 */

import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { performance } from 'perf_hooks';
import type { MockInstance } from 'jest-mock';

import { teamService } from '../../src/services/team.service';
import { teamApi } from '../../src/api/team.api';
import type { Team } from '../../src/types/team.types';

// Mock the team API
jest.mock('../../src/api/team.api');
jest.mock('perf_hooks');

// Constants for testing
const TEST_TENANT_ID = 'test-tenant-123';
const RESPONSE_TIME_SLA = 500; // 500ms SLA requirement
const REAL_TIME_UPDATE_SLA = 2000; // 2 second real-time requirement

// Test data
const mockTeam: Team = {
  id: '123',
  name: 'Test Team',
  totalPoints: 1000,
  memberCount: 5,
  members: [],
  isActive: true,
  lastActivityAt: new Date(),
  version: '1',
  metadata: {},
  companyId: 'company-123',
  organizationId: 'org-123',
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('TeamService', () => {
  // Performance metrics collection
  let responseTimeSamples: number[] = [];
  let updateTimeSamples: number[] = [];

  // API mocks
  let getTeamsMock: MockInstance;
  let getTeamByIdMock: MockInstance;
  let createTeamMock: MockInstance;
  let updateTeamMock: MockInstance;
  let deleteTeamMock: MockInstance;
  let addTeamMemberMock: MockInstance;
  let removeTeamMemberMock: MockInstance;

  beforeEach(() => {
    // Reset metrics
    responseTimeSamples = [];
    updateTimeSamples = [];

    // Reset mocks
    jest.clearAllMocks();
    localStorage.setItem('tenantId', TEST_TENANT_ID);

    // Setup API mocks with timing tracking
    getTeamsMock = jest.spyOn(teamApi, 'getTeams').mockImplementation(async () => ({
      success: true,
      data: { data: [mockTeam], total: 1, page: 1, pageSize: 10 }
    }));

    getTeamByIdMock = jest.spyOn(teamApi, 'getTeamById').mockImplementation(async () => ({
      success: true,
      data: { team: mockTeam, stats: { totalPoints: 1000 }, errors: [] }
    }));

    createTeamMock = jest.spyOn(teamApi, 'createTeam').mockImplementation(async () => ({
      success: true,
      data: mockTeam
    }));

    updateTeamMock = jest.spyOn(teamApi, 'updateTeam').mockImplementation(async () => ({
      success: true,
      data: { ...mockTeam, name: 'Updated Team' }
    }));

    deleteTeamMock = jest.spyOn(teamApi, 'deleteTeam').mockImplementation(async () => ({
      success: true,
      data: undefined
    }));

    addTeamMemberMock = jest.spyOn(teamApi, 'addTeamMember').mockImplementation(async () => ({
      success: true,
      data: { id: 'member-123', teamId: mockTeam.id, userId: 'user-123', totalPoints: 0 }
    }));

    removeTeamMemberMock = jest.spyOn(teamApi, 'removeTeamMember').mockImplementation(async () => ({
      success: true,
      data: undefined
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  // Real-time update tests
  test('should reflect team updates within 2 seconds', async () => {
    const startTime = performance.now();
    let updateDetected = false;

    // Subscribe to team updates
    const subscription = teamService.teams$.subscribe(teams => {
      if (teams.length > 0 && teams[0].name === 'Updated Team') {
        updateDetected = true;
        updateTimeSamples.push(performance.now() - startTime);
      }
    });

    // Trigger update
    await teamService.updateTeam(mockTeam.id, 'Updated Team');

    // Wait for update to propagate
    await new Promise(resolve => setTimeout(resolve, 100));
    subscription.unsubscribe();

    expect(updateDetected).toBe(true);
    expect(Math.max(...updateTimeSamples)).toBeLessThan(REAL_TIME_UPDATE_SLA);
  });

  // Response time SLA tests
  test('should complete operations within 500ms for 95% of requests', async () => {
    const iterations = 100;
    const operations = [
      () => teamService.getTeams({}),
      () => teamService.getTeamById(mockTeam.id),
      () => teamService.createTeam('New Team'),
      () => teamService.updateTeam(mockTeam.id, 'Updated Team'),
      () => teamService.deleteTeam(mockTeam.id)
    ];

    // Execute operations and measure response times
    for (let i = 0; i < iterations; i++) {
      const operation = operations[i % operations.length];
      const startTime = performance.now();
      await operation();
      responseTimeSamples.push(performance.now() - startTime);
    }

    // Calculate 95th percentile
    const sortedTimes = responseTimeSamples.sort((a, b) => a - b);
    const percentile95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

    expect(percentile95).toBeLessThan(RESPONSE_TIME_SLA);
  });

  // Multi-tenant isolation tests
  test('should maintain tenant isolation for team operations', async () => {
    const differentTenantId = 'different-tenant-123';
    localStorage.setItem('tenantId', differentTenantId);

    await teamService.getTeams({});
    expect(getTeamsMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: differentTenantId
    }));
  });

  // Cache behavior tests
  test('should utilize caching for repeated team requests', async () => {
    // First request should hit the API
    await teamService.getTeamById(mockTeam.id);
    expect(getTeamByIdMock).toHaveBeenCalledTimes(1);

    // Second request within cache duration should use cached data
    await teamService.getTeamById(mockTeam.id);
    expect(getTeamByIdMock).toHaveBeenCalledTimes(1);
  });

  // State management tests
  test('should maintain consistent state after operations', async () => {
    // Create team and verify state
    await teamService.createTeam('New Team');
    let teams = await teamService.getTeams({});
    expect(teams.data.data).toHaveLength(1);

    // Update team and verify state
    await teamService.updateTeam(mockTeam.id, 'Updated Team');
    teams = await teamService.getTeams({});
    expect(teams.data.data[0].name).toBe('Updated Team');

    // Delete team and verify state
    await teamService.deleteTeam(mockTeam.id);
    teams = await teamService.getTeams({});
    expect(teams.data.data).toHaveLength(0);
  });

  // Error handling tests
  test('should handle API errors gracefully', async () => {
    getTeamByIdMock.mockRejectedValueOnce(new Error('API Error'));

    await expect(teamService.getTeamById('invalid-id')).rejects.toThrow('API Error');
  });

  // Member management tests
  test('should manage team members correctly', async () => {
    const userId = 'user-123';

    // Add member
    await teamService.addTeamMember(mockTeam.id, userId);
    expect(addTeamMemberMock).toHaveBeenCalledWith(mockTeam.id, userId, TEST_TENANT_ID);

    // Remove member
    await teamService.removeTeamMember(mockTeam.id, userId);
    expect(removeTeamMemberMock).toHaveBeenCalledWith(mockTeam.id, userId, TEST_TENANT_ID);
  });
});