import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, useTheme } from '@mui/material'; // v5.0.0
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'; // v6.4.0

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import ActivityFeed from '../../components/activity/ActivityFeed';
import { useActivity, WebSocketStatus } from '../../hooks/useActivity';
import { Activity } from '../../types/activity.types';
import { useAuth } from '../../hooks/useAuth';

// Styles
import styles from './ActivityPage.module.css';

interface ActivityPageProps {
  refreshInterval?: number;
}

/**
 * ActivityPage component displaying real-time Azure DevOps activities
 * with point tracking and AI detection visualization
 */
const ActivityPage: React.FC<ActivityPageProps> = ({
  refreshInterval = 5000
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { teamId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Local state for filters
  const [filters, setFilters] = useState({
    type: searchParams.get('type') || 'all',
    aiGenerated: searchParams.get('ai') === 'true'
  });

  // Initialize activity hook with tenant isolation
  const {
    activities,
    loading,
    error,
    wsStatus,
    fetchActivities,
    updateAIDetectionStatus
  } = useActivity({
    teamId,
    userId: user?.id,
    tenantId: user?.companyId || '',
    autoRefresh: true,
    wsEnabled: true
  });

  // Memoized connection status display
  const connectionStatus = useMemo(() => {
    const statusMap = {
      [WebSocketStatus.CONNECTED]: {
        color: theme.palette.success.main,
        text: 'Live Updates Active'
      },
      [WebSocketStatus.CONNECTING]: {
        color: theme.palette.warning.main,
        text: 'Connecting...'
      },
      [WebSocketStatus.DISCONNECTED]: {
        color: theme.palette.error.main,
        text: 'Offline - Retrying'
      }
    };
    return statusMap[wsStatus] || statusMap[WebSocketStatus.DISCONNECTED];
  }, [wsStatus, theme]);

  // Handle activity click navigation
  const handleActivityClick = useCallback((activity: Activity) => {
    navigate(`/dashboard/activities/${activity.id}`, {
      state: { activity }
    });
  }, [navigate]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    const params = new URLSearchParams();
    if (newFilters.type !== 'all') params.set('type', newFilters.type);
    if (newFilters.aiGenerated) params.set('ai', 'true');
    navigate(`?${params.toString()}`);
  }, [navigate]);

  // Effect for initial data fetch
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities, teamId, user?.companyId]);

  return (
    <DashboardLayout>
      <div className={styles.container}>
        {/* Header section */}
        <Box className={styles.header}>
          <Typography variant="h4" component="h1">
            Activity Feed
          </Typography>
          
          {/* Connection status indicator */}
          <Box
            className={styles.statusIndicator}
            sx={{ backgroundColor: connectionStatus.color }}
            role="status"
            aria-live="polite"
          >
            <Typography variant="caption" color="white">
              {connectionStatus.text}
            </Typography>
          </Box>
        </Box>

        {/* Main content */}
        <Box className={styles.content}>
          {loading && (
            <Box className={styles.loadingOverlay}>
              <CircularProgress size={40} thickness={4} />
            </Box>
          )}

          {error && (
            <Alert 
              severity="error" 
              className={styles.error}
              action={
                <button onClick={() => fetchActivities()}>
                  Retry
                </button>
              }
            >
              {error}
            </Alert>
          )}

          <ActivityFeed
            teamId={teamId}
            userId={user?.id}
            autoRefresh={true}
            onActivityClick={handleActivityClick}
            virtualizeThreshold={50}
            pageSize={10}
            retryAttempts={3}
          />
        </Box>
      </div>
    </DashboardLayout>
  );
};

// Add display name for debugging
ActivityPage.displayName = 'ActivityPage';

export default ActivityPage;