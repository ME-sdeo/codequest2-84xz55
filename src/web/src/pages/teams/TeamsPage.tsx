import React, { useEffect, useCallback, memo } from 'react'; // react v18.0+
import { useNavigate } from 'react-router-dom'; // v6.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { Container, Typography, Button, Box } from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Internal imports
import TeamList from '../../components/team/TeamList';
import { useTeam } from '../../hooks/useTeam';
import Spinner from '../../components/common/Spinner';
import type { Team } from '../../types/team.types';

// Styled components with accessibility and responsiveness
const PageContainer = styled(Container)(({ theme }) => ({
  maxWidth: theme.breakpoints.values.lg,
  padding: theme.spacing(3),
  '@media (max-width: 600px)': {
    padding: theme.spacing(2),
  },
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
  '@media (max-width: 600px)': {
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'stretch',
  },
}));

const CreateButton = styled(Button)(({ theme }) => ({
  minWidth: '160px',
  height: '44px', // WCAG touch target size
  '@media (max-width: 600px)': {
    width: '100%',
  },
}));

const ErrorContainer = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(3),
  color: theme.palette.error.main,
}));

// Props interface
interface TeamsPageProps {
  organizationId: string;
  className?: string;
}

// Error Fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { 
  error: Error; 
  resetErrorBoundary: () => void;
}) => (
  <ErrorContainer>
    <Typography variant="h6" gutterBottom>
      Error loading teams
    </Typography>
    <Typography variant="body1" paragraph>
      {error.message}
    </Typography>
    <Button 
      variant="contained" 
      onClick={resetErrorBoundary}
      aria-label="Retry loading teams"
    >
      Try Again
    </Button>
  </ErrorContainer>
);

// Memoized TeamsPage component
const TeamsPage = memo<TeamsPageProps>(({ organizationId, className }) => {
  const navigate = useNavigate();
  
  // Initialize team hook with organization context
  const {
    teams,
    loading,
    error,
    createTeam,
    fetchTeams,
  } = useTeam({
    tenantId: organizationId,
    sortBy: 'totalPoints',
    order: 'desc',
  });

  // Set up real-time subscription
  useEffect(() => {
    const subscription = useTeam({
      tenantId: organizationId,
    }).subscription;

    return () => {
      subscription?.unsubscribe();
    };
  }, [organizationId]);

  // Memoized handlers
  const handleTeamSelect = useCallback((team: Team) => {
    navigate(`/teams/${team.id}`);
  }, [navigate]);

  const handleCreateTeam = useCallback(async () => {
    try {
      const newTeam = await createTeam({
        name: 'New Team',
        organizationId,
      });
      navigate(`/teams/${newTeam.id}/edit`);
    } catch (error) {
      console.error('Failed to create team:', error);
    }
  }, [createTeam, organizationId, navigate]);

  // Loading state
  if (loading) {
    return (
      <PageContainer 
        className={className}
        role="main"
        aria-label="Teams Page Loading"
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <Spinner 
            size="large"
            color="primary"
            ariaLabel="Loading teams"
          />
        </Box>
      </PageContainer>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={fetchTeams}
    >
      <PageContainer 
        className={className}
        role="main"
        aria-label="Teams Page"
      >
        <Header>
          <Typography 
            variant="h4" 
            component="h1"
            sx={{ fontWeight: 600 }}
          >
            Teams
          </Typography>
          <CreateButton
            variant="contained"
            color="primary"
            onClick={handleCreateTeam}
            aria-label="Create new team"
            data-testid="create-team-button"
          >
            Create Team
          </CreateButton>
        </Header>

        {error ? (
          <ErrorContainer role="alert" aria-live="polite">
            <Typography color="error">
              {error.message}
            </Typography>
          </ErrorContainer>
        ) : (
          <TeamList
            organizationId={organizationId}
            onTeamSelect={handleTeamSelect}
            data-testid="team-list"
          />
        )}
      </PageContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
TeamsPage.displayName = 'TeamsPage';

export default TeamsPage;