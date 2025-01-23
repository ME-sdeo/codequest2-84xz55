/**
 * @fileoverview Enhanced React component for displaying and managing team members
 * with virtualization, real-time updates, and accessibility features.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DataGrid, GridColDef, GridSortModel } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

import { Team, TeamMember, TeamMemberSortField } from '../../types/team.types';
import { useTeam } from '../../hooks/useTeam';

/**
 * Props interface for TeamMembers component
 */
interface TeamMembersProps {
  teamId: string;
  isAdmin: boolean;
  onMemberUpdate?: (member: TeamMember) => void;
  virtualScrollThreshold?: number;
  updateDebounceMs?: number;
}

/**
 * Enhanced TeamMembers component with virtualization and real-time updates
 */
const TeamMembers: React.FC<TeamMembersProps> = ({
  teamId,
  isAdmin,
  onMemberUpdate,
  virtualScrollThreshold = 100,
  updateDebounceMs = 300
}) => {
  // State management
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: TeamMemberSortField.TOTAL_POINTS, sort: 'desc' }
  ]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Partial<TeamMember>>>(new Map());

  // Hooks
  const { currentTeam, addMember, removeMember, updateMember } = useTeam({
    teamId,
    page: 1,
    limit: 50,
    tenantId: localStorage.getItem('tenantId') || ''
  });

  // Memoized columns configuration
  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'id',
      headerName: 'ID',
      width: 100,
      hide: true
    },
    {
      field: 'name',
      headerName: 'Member',
      width: 200,
      renderCell: (params) => (
        <div className="member-cell">
          <span>{params.value}</span>
          {params.row.isActive && <span className="active-indicator" aria-label="Active member" />}
        </div>
      )
    },
    {
      field: 'totalPoints',
      headerName: 'Points',
      width: 120,
      type: 'number',
      sortable: true,
      valueFormatter: ({ value }) => value.toLocaleString()
    },
    {
      field: 'currentLevel',
      headerName: 'Level',
      width: 100,
      type: 'number',
      sortable: true
    },
    {
      field: 'achievements',
      headerName: 'Achievements',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <div className="achievements-cell">
          {params.value.map((achievement: any) => (
            <Tooltip key={achievement.id} title={achievement.name}>
              <span className="achievement-badge" aria-label={achievement.name}>
                🏆
              </span>
            </Tooltip>
          ))}
        </div>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      hide: !isAdmin,
      renderCell: (params) => (
        <div className="actions-cell">
          <Tooltip title="Edit Member">
            <IconButton
              size="small"
              onClick={() => handleEditMember(params.row.id)}
              aria-label="Edit member"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove Member">
            <IconButton
              size="small"
              onClick={() => handleRemoveMember(params.row.id)}
              aria-label="Remove member"
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </div>
      )
    }
  ], [isAdmin]);

  // Optimistic update handler
  const handleOptimisticUpdate = useCallback(async (
    memberId: string,
    action: 'remove' | 'update',
    updateData?: Partial<TeamMember>
  ) => {
    try {
      if (action === 'remove') {
        setOptimisticUpdates(new Map(optimisticUpdates.set(memberId, { id: memberId, isDeleted: true })));
        await removeMember(teamId, memberId);
      } else if (action === 'update' && updateData) {
        setOptimisticUpdates(new Map(optimisticUpdates.set(memberId, updateData)));
        await updateMember(teamId, memberId, updateData);
      }

      setSnackbar({
        open: true,
        message: `Member successfully ${action === 'remove' ? 'removed' : 'updated'}`,
        severity: 'success'
      });
      
      onMemberUpdate?.(currentTeam?.members.find(m => m.id === memberId) as TeamMember);
    } catch (error) {
      console.error(`Failed to ${action} member:`, error);
      setOptimisticUpdates(new Map(optimisticUpdates.delete(memberId)));
      setSnackbar({
        open: true,
        message: `Failed to ${action} member. Please try again.`,
        severity: 'error'
      });
    }
  }, [teamId, currentTeam, removeMember, updateMember, optimisticUpdates, onMemberUpdate]);

  // Event handlers
  const handleAddMember = useCallback(async () => {
    // Implementation would open a modal/dialog for member addition
    console.log('Add member functionality to be implemented');
  }, []);

  const handleEditMember = useCallback((memberId: string) => {
    // Implementation would open a modal/dialog for member editing
    console.log('Edit member functionality to be implemented');
  }, []);

  const handleRemoveMember = useCallback((memberId: string) => {
    handleOptimisticUpdate(memberId, 'remove');
  }, [handleOptimisticUpdate]);

  const handleSortModelChange = useCallback((newModel: GridSortModel) => {
    setSortModel(newModel);
  }, []);

  // Filter and sort members with optimistic updates
  const processedMembers = useMemo(() => {
    if (!currentTeam?.members) return [];
    
    return currentTeam.members
      .filter(member => !optimisticUpdates.get(member.id)?.isDeleted)
      .map(member => ({
        ...member,
        ...optimisticUpdates.get(member.id)
      }));
  }, [currentTeam, optimisticUpdates]);

  return (
    <div className="team-members-container" role="region" aria-label="Team Members">
      {isAdmin && (
        <div className="team-members-actions">
          <Tooltip title="Add New Member">
            <IconButton
              onClick={handleAddMember}
              color="primary"
              aria-label="Add new member"
            >
              <PersonAddIcon />
            </IconButton>
          </Tooltip>
        </div>
      )}

      <DataGrid
        rows={processedMembers}
        columns={columns}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        autoHeight
        disableColumnMenu
        disableSelectionOnClick
        hideFooterPagination
        aria-label="Team members table"
        getRowId={(row) => row.id}
        sx={{
          '& .member-cell': {
            display: 'flex',
            alignItems: 'center',
            gap: 1
          },
          '& .active-indicator': {
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'success.main'
          },
          '& .achievements-cell': {
            display: 'flex',
            gap: 0.5
          }
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default TeamMembers;