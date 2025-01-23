/**
 * @fileoverview Enhanced React hook for managing team-related state and operations
 * with real-time updates, tenant isolation, and optimized performance.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { teamService } from '../services/team.service';
import type { Team, TeamError, TeamSortField } from '../types/team.types';
import type { ApiResponse, PaginatedResponse } from '../types/common.types';

// Constants for hook configuration
const DEBOUNCE_TIME = 500; // 500ms debounce for real-time updates
const DEFAULT_PAGE_SIZE = 10;

/**
 * Interface for hook options with tenant awareness
 */
interface UseTeamOptions {
  teamId?: string;
  page?: number;
  limit?: number;
  sortBy?: TeamSortField;
  order?: 'asc' | 'desc';
  tenantId: string;
}

/**
 * Enhanced hook for managing team state and operations with real-time updates
 * and tenant isolation.
 */
export function useTeam({
  teamId,
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  sortBy = TeamSortField.NAME,
  order = 'asc',
  tenantId
}: UseTeamOptions) {
  // State management with strict typing
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<TeamError | null>(null);
  const [subscription, setSubscription] = useState<Subject<Team[]> | null>(null);

  /**
   * Fetches teams with tenant validation and pagination
   */
  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response: ApiResponse<PaginatedResponse<Team>> = await teamService.getTeams({
        page,
        limit,
        sortBy,
        order,
        tenantId
      });

      if (response.success) {
        setTeams(response.data.data);
      } else {
        setError({
          code: 'FETCH_ERROR',
          message: response.error || 'Failed to fetch teams',
          field: '',
          details: null
        });
      }
    } catch (err) {
      setError({
        code: 'UNEXPECTED_ERROR',
        message: 'An unexpected error occurred while fetching teams',
        field: '',
        details: err
      });
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, order, tenantId]);

  /**
   * Fetches a specific team by ID with tenant validation
   */
  const fetchTeamById = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await teamService.getTeamById(id);
      
      if (response.success) {
        setCurrentTeam(response.data.team);
      } else {
        setError({
          code: 'FETCH_ERROR',
          message: response.error || 'Failed to fetch team',
          field: 'id',
          details: null
        });
      }
    } catch (err) {
      setError({
        code: 'UNEXPECTED_ERROR',
        message: 'An unexpected error occurred while fetching team',
        field: 'id',
        details: err
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Creates a new team with tenant validation
   */
  const createTeam = useCallback(async (data: { name: string, organizationId: string }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await teamService.createTeam(data.name, { organizationId: data.organizationId });
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      setError({
        code: 'CREATE_ERROR',
        message: 'Failed to create team',
        field: 'name',
        details: err
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates an existing team with tenant validation
   */
  const updateTeam = useCallback(async (id: string, data: { name: string }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await teamService.updateTeam(id, data.name);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      setError({
        code: 'UPDATE_ERROR',
        message: 'Failed to update team',
        field: 'name',
        details: err
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deletes a team with tenant validation
   */
  const deleteTeam = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await teamService.deleteTeam(id);
      
      if (!response.success) {
        throw new Error(response.error);
      }
    } catch (err) {
      setError({
        code: 'DELETE_ERROR',
        message: 'Failed to delete team',
        field: 'id',
        details: err
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Adds a member to a team with tenant validation
   */
  const addMember = useCallback(async (teamId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await teamService.addTeamMember(teamId, userId);
      
      if (!response.success) {
        throw new Error(response.error);
      }
    } catch (err) {
      setError({
        code: 'ADD_MEMBER_ERROR',
        message: 'Failed to add team member',
        field: 'userId',
        details: err
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Removes a member from a team with tenant validation
   */
  const removeMember = useCallback(async (teamId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await teamService.removeTeamMember(teamId, userId);
      
      if (!response.success) {
        throw new Error(response.error);
      }
    } catch (err) {
      setError({
        code: 'REMOVE_MEMBER_ERROR',
        message: 'Failed to remove team member',
        field: 'userId',
        details: err
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up real-time updates subscription
  useEffect(() => {
    const sub = teamService.teams$
      .pipe(debounceTime(DEBOUNCE_TIME))
      .subscribe({
        next: (updatedTeams) => {
          setTeams(updatedTeams);
          if (teamId && currentTeam) {
            const updatedTeam = updatedTeams.find(t => t.id === teamId);
            if (updatedTeam) {
              setCurrentTeam(updatedTeam);
            }
          }
        },
        error: (err) => {
          setError({
            code: 'SUBSCRIPTION_ERROR',
            message: 'Real-time update error',
            field: '',
            details: err
          });
        }
      });

    setSubscription(sub);

    return () => {
      sub.unsubscribe();
    };
  }, [teamId, currentTeam]);

  // Initial data fetch
  useEffect(() => {
    if (teamId) {
      fetchTeamById(teamId);
    } else {
      fetchTeams();
    }
  }, [teamId, page, limit, sortBy, order, tenantId, fetchTeams, fetchTeamById]);

  return {
    teams,
    currentTeam,
    loading,
    error,
    fetchTeams,
    fetchTeamById,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    subscription
  };
}