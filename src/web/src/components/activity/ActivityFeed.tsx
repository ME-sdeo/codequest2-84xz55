import React, { useCallback, useMemo } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material'; // @mui/material v5.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import { FixedSizeList as VirtualList } from 'react-window'; // react-window v1.8+

import ActivityCard from './ActivityCard';
import { Activity } from '../../types/activity.types';
import { useActivity, WebSocketStatus } from '../../hooks/useActivity';

// Styled components with accessibility support
const StyledFeed = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  width: '100%',
  maxWidth: '800px',
  margin: '0 auto',
  padding: theme.spacing(2),
  position: 'relative',

  '& .connection-status': {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 1,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.5, 1),
    fontSize: '0.875rem',
    
    '&.connected': {
      backgroundColor: theme.palette.success.light,
      color: theme.palette.success.contrastText,
    },
    '&.disconnected': {
      backgroundColor: theme.palette.error.light,
      color: theme.palette.error.contrastText,
    },
    '&.connecting': {
      backgroundColor: theme.palette.warning.light,
      color: theme.palette.warning.contrastText,
    },
  },

  '& .loading-container': {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },

  '& .error-container': {
    textAlign: 'center',
    padding: theme.spacing(2),
  },

  '& .virtual-list': {
    scrollbarWidth: 'thin',
    '&::-webkit-scrollbar': {
      width: '6px',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: theme.palette.divider,
      borderRadius: '3px',
    },
  },
}));

interface ActivityFeedProps {
  teamId?: string;
  userId?: string;
  autoRefresh?: boolean;
  onActivityClick?: (activity: Activity) => void;
  className?: string;
  virtualizeThreshold?: number;
  pageSize?: number;
  retryAttempts?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = React.memo(({
  teamId,
  userId,
  autoRefresh = true,
  onActivityClick,
  className,
  virtualizeThreshold = 50,
  pageSize = 10,
  retryAttempts = 3,
}) => {
  // Initialize activity hook with enhanced options
  const {
    activities,
    loading,
    error,
    wsStatus,
    fetchActivities,
  } = useActivity({
    teamId,
    userId,
    autoRefresh,
    wsEnabled: true,
    tenantId: window.__TENANT_ID__, // Injected by the application
  });

  // Sort activities by timestamp in descending order
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activities]);

  // Memoized activity click handler
  const handleActivityClick = useCallback((activity: Activity) => {
    onActivityClick?.(activity);
  }, [onActivityClick]);

  // Memoized virtual row renderer
  const renderRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const activity = sortedActivities[index];
    return (
      <Box style={style}>
        <ActivityCard
          activity={activity}
          onClick={() => handleActivityClick(activity)}
          elevated={false}
          dir="ltr"
        />
      </Box>
    );
  }, [sortedActivities, handleActivityClick]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Render loading state
  if (loading) {
    return (
      <StyledFeed className={className}>
        <Box className="loading-container" role="status" aria-label="Loading activities">
          <CircularProgress size={40} thickness={4} />
        </Box>
      </StyledFeed>
    );
  }

  // Render error state
  if (error) {
    return (
      <StyledFeed className={className}>
        <Box className="error-container">
          <Alert 
            severity="error" 
            action={
              <button onClick={handleRetry} className="retry-button">
                Retry
              </button>
            }
          >
            {error}
          </Alert>
        </Box>
      </StyledFeed>
    );
  }

  // Render empty state
  if (sortedActivities.length === 0) {
    return (
      <StyledFeed className={className}>
        <Typography 
          variant="body1" 
          color="textSecondary" 
          align="center"
          role="status"
        >
          No activities to display
        </Typography>
      </StyledFeed>
    );
  }

  return (
    <StyledFeed className={className}>
      {/* WebSocket connection status */}
      <Box 
        className={`connection-status ${wsStatus.toLowerCase()}`}
        role="status"
        aria-live="polite"
      >
        {wsStatus === WebSocketStatus.CONNECTED ? 'Live' : 
         wsStatus === WebSocketStatus.CONNECTING ? 'Connecting...' : 
         'Offline'}
      </Box>

      {/* Activity list with virtualization for large datasets */}
      {sortedActivities.length > virtualizeThreshold ? (
        <VirtualList
          className="virtual-list"
          height={600}
          width="100%"
          itemCount={sortedActivities.length}
          itemSize={120}
          overscanCount={2}
        >
          {renderRow}
        </VirtualList>
      ) : (
        <Box role="feed" aria-label="Activity feed">
          {sortedActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={() => handleActivityClick(activity)}
              elevated={false}
              dir="ltr"
            />
          ))}
        </Box>
      )}

      {/* Live region for screen readers */}
      <Box 
        role="status" 
        aria-live="polite" 
        className="visually-hidden"
      >
        {`${sortedActivities.length} activities displayed`}
      </Box>
    </StyledFeed>
  );
});

ActivityFeed.displayName = 'ActivityFeed';

export default ActivityFeed;