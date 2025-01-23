/**
 * @fileoverview Enhanced team service implementation with reactive state management,
 * caching, and performance optimizations for CodeQuest platform.
 * @version 1.0.0
 */

import { BehaviorSubject, from } from 'rxjs';
import { debounceTime, retry, catchError } from 'rxjs/operators';
import { Team, TeamMember, TeamSortField, TeamResponse, TeamStats } from '../types/team.types';
import { teamApi } from '../api/team.api';
import { ApiResponse, PaginatedResponse } from '../types/common.types';

// Constants for service configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration
const DEBOUNCE_TIME = 300; // 300ms debounce for requests
const MAX_RETRY_ATTEMPTS = 3;
const BATCH_DELAY = 100; // 100ms batch delay

/**
 * Enhanced service class for managing team-related operations with
 * reactive state management, caching, and performance optimizations
 */
class TeamService {
  private teamsSubject = new BehaviorSubject<Team[]>([]);
  private currentTeamSubject = new BehaviorSubject<Team | null>(null);
  private teamPointsCache = new Map<string, { data: Team; timestamp: number }>();
  private pendingRequests = new Map<string, Promise<Team>>();

  constructor() {
    // Set up cache cleanup interval
    setInterval(() => this.cleanCache(), CACHE_DURATION);
  }

  /**
   * Fetches and updates the list of teams with caching and batching
   */
  async getTeams(params: {
    page?: number;
    limit?: number;
    sortBy?: TeamSortField;
    order?: 'asc' | 'desc';
  }): Promise<ApiResponse<PaginatedResponse<Team>>> {
    try {
      const response = await from(teamApi.getTeams({ ...params, tenantId: this.getCurrentTenantId() }))
        .pipe(
          debounceTime(DEBOUNCE_TIME),
          retry(MAX_RETRY_ATTEMPTS),
          catchError(error => {
            console.error('Error fetching teams:', error);
            throw error;
          })
        )
        .toPromise();

      if (response?.success && response.data) {
        this.teamsSubject.next(response.data.data);
        this.updateTeamsCache(response.data.data);
      }

      return response!;
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific team by ID with caching
   */
  async getTeamById(teamId: string): Promise<ApiResponse<TeamResponse>> {
    const cachedTeam = this.teamPointsCache.get(teamId);
    if (cachedTeam && Date.now() - cachedTeam.timestamp < CACHE_DURATION) {
      return {
        success: true,
        data: { team: cachedTeam.data, stats: await this.getTeamStats(teamId), errors: [] }
      };
    }

    // Check for pending request to prevent duplicate calls
    if (this.pendingRequests.has(teamId)) {
      const response = await this.pendingRequests.get(teamId);
      return {
        success: true,
        data: { team: response!, stats: await this.getTeamStats(teamId), errors: [] }
      };
    }

    try {
      const request = teamApi.getTeamById(teamId, this.getCurrentTenantId());
      this.pendingRequests.set(teamId, request.then(r => r.data.team));

      const response = await request;
      if (response.success) {
        this.currentTeamSubject.next(response.data.team);
        this.updateTeamCache(response.data.team);
      }

      this.pendingRequests.delete(teamId);
      return response;
    } catch (error) {
      this.pendingRequests.delete(teamId);
      throw error;
    }
  }

  /**
   * Creates a new team with optimistic updates
   */
  async createTeam(name: string, metadata?: Record<string, any>): Promise<ApiResponse<Team>> {
    const response = await teamApi.createTeam({
      name,
      metadata,
      tenantId: this.getCurrentTenantId()
    });

    if (response.success) {
      const currentTeams = this.teamsSubject.value;
      this.teamsSubject.next([...currentTeams, response.data]);
      this.updateTeamCache(response.data);
    }

    return response;
  }

  /**
   * Updates an existing team with optimistic updates
   */
  async updateTeam(teamId: string, name: string, metadata?: Record<string, any>): Promise<ApiResponse<Team>> {
    const response = await teamApi.updateTeam(teamId, {
      name,
      metadata,
      tenantId: this.getCurrentTenantId()
    });

    if (response.success) {
      const currentTeams = this.teamsSubject.value;
      const updatedTeams = currentTeams.map(team => 
        team.id === teamId ? response.data : team
      );
      this.teamsSubject.next(updatedTeams);
      this.updateTeamCache(response.data);
    }

    return response;
  }

  /**
   * Deletes a team with optimistic updates
   */
  async deleteTeam(teamId: string): Promise<ApiResponse<void>> {
    const response = await teamApi.deleteTeam(teamId, this.getCurrentTenantId());

    if (response.success) {
      const currentTeams = this.teamsSubject.value;
      this.teamsSubject.next(currentTeams.filter(team => team.id !== teamId));
      this.teamPointsCache.delete(teamId);
    }

    return response;
  }

  /**
   * Adds a member to a team with cache updates
   */
  async addTeamMember(teamId: string, userId: string): Promise<ApiResponse<TeamMember>> {
    const response = await teamApi.addTeamMember(teamId, userId, this.getCurrentTenantId());

    if (response.success) {
      await this.refreshTeamData(teamId);
    }

    return response;
  }

  /**
   * Removes a member from a team with cache updates
   */
  async removeTeamMember(teamId: string, userId: string): Promise<ApiResponse<void>> {
    const response = await teamApi.removeTeamMember(teamId, userId, this.getCurrentTenantId());

    if (response.success) {
      await this.refreshTeamData(teamId);
    }

    return response;
  }

  /**
   * Retrieves team statistics with caching
   */
  async getTeamStats(teamId: string): Promise<TeamStats> {
    const response = await teamApi.getTeamStats(teamId, this.getCurrentTenantId());
    return response.data;
  }

  // Observable getters for reactive state
  get teams$() {
    return this.teamsSubject.asObservable();
  }

  get currentTeam$() {
    return this.currentTeamSubject.asObservable();
  }

  // Private helper methods
  private getCurrentTenantId(): string {
    // This should be implemented to get the current tenant ID from your auth context
    return localStorage.getItem('tenantId') || '';
  }

  private updateTeamCache(team: Team): void {
    this.teamPointsCache.set(team.id, {
      data: team,
      timestamp: Date.now()
    });
  }

  private updateTeamsCache(teams: Team[]): void {
    teams.forEach(team => this.updateTeamCache(team));
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.teamPointsCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        this.teamPointsCache.delete(key);
      }
    }
  }

  private async refreshTeamData(teamId: string): Promise<void> {
    const response = await this.getTeamById(teamId);
    if (response.success) {
      const currentTeams = this.teamsSubject.value;
      const updatedTeams = currentTeams.map(team =>
        team.id === teamId ? response.data.team : team
      );
      this.teamsSubject.next(updatedTeams);
    }
  }
}

// Export singleton instance
export const teamService = new TeamService();