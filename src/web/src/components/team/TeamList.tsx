import React, { useEffect, useMemo, useCallback } from 'react'; // react v18.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import { Grid, Typography, Box } from '@mui/material'; // @mui/material v5.0+
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Internal imports
import TeamCard from './TeamCard';
import { useTeam } from '../../hooks/useTeam';
import Spinner from '../common/Spinner';
import type { Team, TeamSortField } from '../../types/team.types';

// Styled components with accessibility and RTL support
const StyledGrid = styled(Grid)(({ theme }) => ({
  container: true,
  spacing: 3,
  padding: theme.spacing(3),
  '@media (max-width: 600px)': {
    spacing: 2,
    padding: theme.spacing(2),
  },
  '[dir="rtl"] &': {
    direction: 'row-reverse',
  },
}));

const LoadingContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '200px',
  width: '100%',
});

const ErrorMessage = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  textAlign: 'center',
  marginTop: theme.spacing(4),
  padding: theme.spacing(2),
}));

// Interface definitions
interface TeamListProps {
  organizationId: string;
  onTeamSelect: (team: Team) => void;
  className?: string;
  sortBy?: TeamSortField;
  filterBy?: {
    isActive?: boolean;
    minPoints?: number;
    maxPoints?: number;
    searchTerm?: string;
  };
}

// Error Fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { 
  error: Error; 
  resetErrorBoundary: () => void;
}) => (
  <ErrorMessage 
    variant="body1" 
    role="alert"
    aria-live="polite"
  >
    {error.message}
    <Box mt={2}>
      <button 
        onClick={resetErrorBoundary}
        style={{ padding: '8px 16px' }}
      >
        Try again
      </button>
    </Box>
  </ErrorMessage>
);

// Memoized TeamList component
const TeamList = React.memo<TeamListProps>(({
  organizationId,
  onTeamSelect,
  className,
  sortBy = TeamSortField.TOTAL_POINTS,
  filterBy = {},
}) => {
  // Initialize team hook with organization context
  const {
    teams,
    loading,
    error,
    fetchTeams,
  } = useTeam({
    tenantId: organizationId,
    sortBy,
    order: 'desc',
  });

  // Set up real-time updates on mount
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams, organizationId, sortBy]);

  // Memoized filtered and sorted teams
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      const { isActive, minPoints, maxPoints, searchTerm } = filterBy;
      
      if (isActive !== undefined && team.isActive !== isActive) return false;
      if (minPoints !== undefined && team.totalPoints < minPoints) return false;
      if (maxPoints !== undefined && team.totalPoints > maxPoints) return false;
      if (searchTerm && !team.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      return true;
    });
  }, [teams, filterBy]);

  // Memoized team selection handler
  const handleTeamSelect = useCallback((team: Team) => {
    onTeamSelect(team);
  }, [onTeamSelect]);

  // Loading state
  if (loading) {
    return (
      <LoadingContainer>
        <Spinner 
          size="large"
          color="primary"
          ariaLabel="Loading teams"
        />
      </LoadingContainer>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorMessage 
        variant="body1" 
        role="alert"
        aria-live="assertive"
      >
        {error.message}
      </ErrorMessage>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={fetchTeams}
    >
      <StyledGrid
        className={className}
        role="grid"
        aria-label="Teams list"
      >
        {filteredTeams.map((team) => (
          <Grid 
            item 
            xs={12} 
            sm={6} 
            md={4} 
            lg={3} 
            key={team.id}
            role="gridcell"
          >
            <TeamCard
              team={team}
              onClick={handleTeamSelect}
              elevated
              ariaLabel={`Select ${team.name} team with ${team.memberCount} members and ${team.totalPoints} points`}
              dataTestId={`team-card-${team.id}`}
            />
          </Grid>
        ))}
        
        {filteredTeams.length === 0 && (
          <Grid item xs={12}>
            <Typography
              variant="body1"
              color="textSecondary"
              align="center"
              role="status"
              aria-live="polite"
            >
              No teams found
            </Typography>
          </Grid>
        )}
      </StyledGrid>
    </ErrorBoundary>
  );
});

// Display name for debugging
TeamList.displayName = 'TeamList';

export default TeamList;