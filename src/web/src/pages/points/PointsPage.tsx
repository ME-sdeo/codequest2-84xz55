/**
 * @fileoverview Points page component that displays comprehensive points information
 * with real-time updates, accessibility features, and responsive design.
 * @version 1.0.0
 */

// External imports
import React, { useEffect, useState, useCallback } from 'react';
import {
  Grid,
  Container,
  Typography,
  Skeleton,
  useMediaQuery,
  useTheme
} from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Internal imports
import PointsCard from '../../components/points/PointsCard';
import PointsHistory from '../../components/points/PointsHistory';
import PointsChart from '../../components/points/PointsChart';
import { usePoints } from '../../hooks/usePoints';

// Props interface
interface PointsPageProps {
  teamMemberId: string;
}

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Container>
    <Typography variant="h6" color="error" gutterBottom>
      Error loading points data
    </Typography>
    <Typography variant="body2">{error.message}</Typography>
  </Container>
);

/**
 * Points page component that displays comprehensive points information
 * with real-time updates and responsive design.
 */
const PointsPage: React.FC<PointsPageProps> = ({ teamMemberId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [totalPoints, setTotalPoints] = useState<number>(0);

  // Initialize points hook with real-time updates
  const {
    pointsHistory,
    levelProgress,
    loading,
    error,
    wsStatus,
    getPointsHistory,
    getLevelProgress,
  } = usePoints(teamMemberId, {
    enableRealTime: true,
    cacheResults: true,
    retryOnFailure: true,
  });

  // Handle points updates from child components
  const handlePointsUpdate = useCallback((points: number) => {
    setTotalPoints(points);
  }, []);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([
          getPointsHistory(),
          getLevelProgress()
        ]);
      } catch (err) {
        console.error('Failed to fetch points data:', err);
      }
    };

    fetchData();
  }, [getPointsHistory, getLevelProgress]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Container
        maxWidth="lg"
        sx={{
          padding: theme.spacing(3),
          marginTop: theme.spacing(2),
          minHeight: '100vh',
        }}
      >
        {/* Page Header */}
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ marginBottom: theme.spacing(3) }}
        >
          Points Dashboard
          {loading.points && <Skeleton width={100} />}
        </Typography>

        <Grid container spacing={isMobile ? 2 : 3}>
          {/* Points Summary Card */}
          <Grid item xs={12} md={4}>
            <PointsCard
              teamMemberId={teamMemberId}
              tenantId={wsStatus.tenantId}
              elevated
              showAIIndicator
              className="points-summary-card"
            />
          </Grid>

          {/* Points Chart */}
          <Grid item xs={12} md={8}>
            <PointsChart
              teamMemberId={teamMemberId}
              timeRange="30d"
              height={300}
              onDataUpdate={handlePointsUpdate}
              accessibilityLabel="Points trend over time"
              className="points-trend-chart"
            />
          </Grid>

          {/* Points History */}
          <Grid item xs={12}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              sx={{ marginTop: theme.spacing(4) }}
            >
              Points History
            </Typography>
            <PointsHistory
              teamMemberId={teamMemberId}
              pageSize={10}
              showAiIndicator
              onPointsUpdate={handlePointsUpdate}
            />
          </Grid>
        </Grid>

        {/* Connection Status */}
        {!wsStatus.connected && (
          <Typography
            variant="body2"
            color="error"
            sx={{ marginTop: theme.spacing(2) }}
            role="alert"
          >
            Real-time updates disconnected. Attempting to reconnect...
          </Typography>
        )}

        {/* Error Display */}
        {error && (
          <Typography
            variant="body2"
            color="error"
            sx={{ marginTop: theme.spacing(2) }}
            role="alert"
          >
            {error.points || error.levelProgress}
          </Typography>
        )}
      </Container>
    </ErrorBoundary>
  );
};

export default PointsPage;