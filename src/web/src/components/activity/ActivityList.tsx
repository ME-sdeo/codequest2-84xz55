import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, CircularProgress, Typography, Alert, Skeleton } from '@mui/material'; // @mui/material v5.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import { useVirtualizer } from '@tanstack/react-virtual'; // @tanstack/react-virtual v3.0+

// Internal imports
import ActivityCard from './ActivityCard';
import { Activity } from '../../types/activity.types';
import { useActivity } from '../../hooks/useActivity';

// Styled components with accessibility support
const StyledList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  width: '100%',
  maxWidth: '800px',
  margin: '0 auto',
  padding: theme.spacing(2),
  position: 'relative',
  minHeight: '200px',
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  }
}));

const LoadingContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '200px',
  width: '100%'
});

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(4),
  color: theme.palette.text.secondary,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2)
}));

const ErrorContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  marginBottom: theme.spacing(3)
}));

// Props interface with comprehensive options
interface ActivityListProps {
  teamId?: string;
  userId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onActivityClick?: (activity: Activity) => void;
  className?: string;
  virtualizeList?: boolean;
  pageSize?: number;
  showAIDetection?: boolean;
}

const ActivityList: React.FC<ActivityListProps> = React.memo(({
  teamId,
  userId,
  autoRefresh = true,
  refreshInterval = 5000,
  onActivityClick,
  className,
  virtualizeList = true,
  pageSize = 10,
  showAIDetection = true
}) => {
  // Get tenant ID from context or environment
  const tenantId = process.env.VITE_TENANT_ID || '';
  
  // Initialize activity hook with options
  const {
    activities,
    loading,
    error,
    fetchActivities,
    wsStatus
  } = useActivity({
    teamId,
    userId,
    tenantId,
    autoRefresh,
    wsEnabled: true
  });

  // Container ref for virtualization
  const parentRef = useRef<HTMLDivElement>(null);

  // Set up virtualization if enabled
  const rowVirtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 120, []), // Estimated activity card height
    overscan: 5
  });

  // Handle activity click with proper event handling
  const handleActivityClick = useCallback((activity: Activity) => {
    onActivityClick?.(activity);
  }, [onActivityClick]);

  // Set up auto-refresh interval if WebSocket is not available
  useEffect(() => {
    if (autoRefresh && wsStatus === 'DISCONNECTED') {
      const interval = setInterval(() => {
        fetchActivities();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, wsStatus, fetchActivities]);

  // Memoized empty state component
  const EmptyStateComponent = useMemo(() => (
    <EmptyState>
      <Typography variant="h6" component="h3">
        No Activities Yet
      </Typography>
      <Typography variant="body2">
        Activities will appear here once they are recorded in Azure DevOps
      </Typography>
    </EmptyState>
  ), []);

  // Loading state with skeleton
  if (loading) {
    return (
      <StyledList className={className}>
        {Array.from({ length: 3 }).map((_, index) => (
          <ActivityCard
            key={`skeleton-${index}`}
            activity={null as any}
            loading={true}
          />
        ))}
      </StyledList>
    );
  }

  // Error state with retry option
  if (error) {
    return (
      <ErrorContainer>
        <Alert 
          severity="error" 
          action={
            <button onClick={() => fetchActivities()}>
              Retry
            </button>
          }
        >
          {error}
        </Alert>
      </ErrorContainer>
    );
  }

  // Empty state
  if (!activities.length) {
    return EmptyStateComponent;
  }

  // Virtualized list
  if (virtualizeList) {
    return (
      <StyledList
        ref={parentRef}
        className={className}
        role="feed"
        aria-busy={loading}
        aria-live="polite"
      >
        <Box 
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const activity = activities[virtualRow.index];
            return (
              <Box
                key={activity.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <ActivityCard
                  activity={activity}
                  onClick={handleActivityClick}
                  elevated={false}
                  showAIDetection={showAIDetection}
                />
              </Box>
            );
          })}
        </Box>
      </StyledList>
    );
  }

  // Standard list for smaller datasets
  return (
    <StyledList
      className={className}
      role="feed"
      aria-busy={loading}
      aria-live="polite"
    >
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onClick={handleActivityClick}
          elevated={false}
          showAIDetection={showAIDetection}
        />
      ))}
    </StyledList>
  );
});

ActivityList.displayName = 'ActivityList';

export default ActivityList;