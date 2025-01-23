import React, { useCallback, useEffect, useMemo } from 'react';
import { Grid, Box, Typography, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ErrorBoundary } from 'react-error-boundary';

// Internal components
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import ActivityFeed from '../../components/activity/ActivityFeed';
import PointsCard from '../../components/points/PointsCard';
import LeaderboardCard from '../../components/leaderboard/LeaderboardCard';

// Hooks
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';

// Styled components
const StyledGrid = styled(Grid)(({ theme }) => ({
  container: {
    padding: theme.spacing(3),
    gap: theme.spacing(3),
    maxWidth: '1600px',
    margin: '0 auto',
    height: '100%'
  },
  pointsSection: {
    gridColumn: {
      xs: '1 / -1',
      sm: '1 / -1',
      md: '1 / 4'
    }
  },
  activitySection: {
    gridColumn: {
      xs: '1 / -1',
      sm: '1 / -1',
      md: '4 / 9'
    },
    height: '100%'
  },
  leaderboardSection: {
    gridColumn: {
      xs: '1 / -1',
      sm: '1 / -1',
      md: '9 / -1'
    }
  }
}));

// Error Fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Box role="alert" p={3} textAlign="center">
    <Typography variant="h6" color="error" gutterBottom>
      Something went wrong:
    </Typography>
    <Typography variant="body1">{error.message}</Typography>
  </Box>
);

// Props interface
interface DashboardPageProps {
  refreshInterval?: number;
  initialData?: {
    activities?: any[];
    points?: number;
    leaderboard?: any[];
  };
}

/**
 * Enhanced dashboard page component with real-time updates and optimized performance
 */
const DashboardPage: React.FC<DashboardPageProps> = React.memo(({
  refreshInterval = 2000,
  initialData
}) => {
  const { user } = useAuth();
  const { 
    isConnected: wsConnected,
    connectionState,
    subscribe
  } = useWebSocket();

  // Subscribe to real-time updates
  useEffect(() => {
    if (user?.companyId) {
      const unsubscribePoints = subscribe('points:update', handlePointsUpdate, {
        retryAttempts: 3,
        timeout: 5000
      });

      const unsubscribeActivities = subscribe('activity:new', handleActivityUpdate, {
        retryAttempts: 3,
        timeout: 5000
      });

      return () => {
        unsubscribePoints();
        unsubscribeActivities();
      };
    }
  }, [user?.companyId, subscribe]);

  // Memoized handlers for real-time updates
  const handlePointsUpdate = useCallback((data: any) => {
    // Handle points update
  }, []);

  const handleActivityUpdate = useCallback((data: any) => {
    // Handle activity update
  }, []);

  const handleActivityClick = useCallback((activity: any) => {
    // Handle activity click
  }, []);

  // Loading state
  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <StyledGrid container>
          {/* Points Section */}
          <Grid item className="pointsSection">
            <PointsCard
              teamMemberId={user.id}
              tenantId={user.companyId}
              elevated
              showAIIndicator
              updateInterval={refreshInterval}
            />
          </Grid>

          {/* Activity Feed Section */}
          <Grid item className="activitySection">
            <ActivityFeed
              teamId={user.teamId}
              userId={user.id}
              autoRefresh={true}
              onActivityClick={handleActivityClick}
              virtualizeThreshold={50}
              pageSize={10}
              retryAttempts={3}
            />
          </Grid>

          {/* Leaderboard Section */}
          <Grid item className="leaderboardSection">
            <Box>
              <Typography variant="h6" gutterBottom>
                Team Leaderboard
              </Typography>
              {initialData?.leaderboard?.map((entry) => (
                <LeaderboardCard
                  key={entry.userId}
                  entry={entry}
                  onClick={handleActivityClick}
                  highlighted={entry.userId === user.id}
                />
              ))}
            </Box>
          </Grid>
        </StyledGrid>

        {/* WebSocket Status Indicator */}
        {!wsConnected && (
          <Box
            position="fixed"
            bottom={16}
            right={16}
            bgcolor="warning.main"
            color="warning.contrastText"
            px={2}
            py={1}
            borderRadius={1}
          >
            <Typography variant="body2">
              Reconnecting to real-time updates...
            </Typography>
          </Box>
        )}
      </ErrorBoundary>
    </DashboardLayout>
  );
});

// Display name for debugging
DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;