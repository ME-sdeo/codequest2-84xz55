/**
 * @fileoverview Enhanced points card component with real-time updates and AI detection
 * Displays user points, level progress, and recent activities in an elevated surface
 * @version 1.0.0
 */

// External imports
import React, { useCallback, useEffect, useMemo } from 'react'; // v18.0.0
import { LinearProgress, Typography } from '@mui/material'; // v5.0.0
import { debounce } from 'lodash'; // v4.17.21
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import { performanceMonitor } from '@performance-monitor/react'; // v1.0.0

// Internal imports
import Card from '../common/Card';
import { usePoints } from '../../hooks/usePoints';
import { formatPoints } from '../../utils/points.utils';
import { styled } from '@mui/material/styles';

// Interface definitions
interface PointsCardProps {
  teamMemberId: string;
  tenantId: string;
  elevated?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  showAIIndicator?: boolean;
  updateInterval?: number;
}

// Styled components
const StyledPointsCard = styled(Card)(({ theme }) => ({
  minWidth: '300px',
  padding: theme.spacing(3),
  position: 'relative',

  '.header': {
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  '.progressBar': {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    height: 8,
  },

  '.pointsText': {
    color: theme.palette.primary.main,
    fontWeight: 'bold',
    fontSize: theme.typography.h4.fontSize,
  },

  '.aiIndicator': {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    padding: theme.spacing(0.5),
    backgroundColor: theme.palette.secondary.light,
    borderRadius: theme.shape.borderRadius,
    fontSize: theme.typography.caption.fontSize,
  },
}));

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <StyledPointsCard elevated>
    <Typography color="error" variant="body2">
      Error loading points: {error.message}
    </Typography>
  </StyledPointsCard>
);

/**
 * Enhanced PointsCard component with real-time updates and error handling
 */
const PointsCard = React.memo<PointsCardProps>(({
  teamMemberId,
  tenantId,
  elevated = false,
  interactive = false,
  className,
  onClick,
  showAIIndicator = true,
  updateInterval = 2000,
}) => {
  // Initialize hooks with performance monitoring
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

  // Performance monitoring setup
  useEffect(() => {
    performanceMonitor.trackComponent('PointsCard', {
      teamMemberId,
      tenantId,
      wsConnected: wsStatus.connected,
    });
  }, [teamMemberId, tenantId, wsStatus.connected]);

  // Debounced update handler
  const handlePointsUpdate = useMemo(
    () => debounce(async () => {
      try {
        await Promise.all([
          getPointsHistory(),
          getLevelProgress(),
        ]);
      } catch (err) {
        console.error('Failed to update points:', err);
      }
    }, updateInterval),
    [getPointsHistory, getLevelProgress, updateInterval]
  );

  // Initialize real-time updates
  useEffect(() => {
    handlePointsUpdate();
    return () => {
      handlePointsUpdate.cancel();
    };
  }, [handlePointsUpdate]);

  // Click handler with performance tracking
  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    performanceMonitor.trackEvent('PointsCardClick', { teamMemberId });
    onClick?.(event);
  }, [onClick, teamMemberId]);

  // Format points for display
  const formattedPoints = useMemo(() => {
    const totalPoints = pointsHistory?.[0]?.points || 0;
    return formatPoints(totalPoints, { useKSuffix: true, showSign: false });
  }, [pointsHistory]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    return levelProgress?.progressPercentage || 0;
  }, [levelProgress]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <StyledPointsCard
        elevated={elevated}
        interactive={interactive}
        className={className}
        onClick={interactive ? handleClick : undefined}
        role="region"
        aria-label="Points Summary"
      >
        {/* Points Header */}
        <div className="header">
          <Typography variant="h6">Points</Typography>
          <Typography className="pointsText">
            {loading.points ? '...' : formattedPoints}
          </Typography>
        </div>

        {/* Level Progress */}
        {levelProgress && (
          <>
            <Typography variant="body2" color="textSecondary">
              Level {levelProgress.currentLevel}
            </Typography>
            <LinearProgress
              className="progressBar"
              variant="determinate"
              value={progressPercentage}
              aria-label={`Level progress: ${progressPercentage}%`}
            />
            <Typography variant="caption" color="textSecondary">
              {levelProgress.pointsToNextLevel} points to next level
            </Typography>
          </>
        )}

        {/* AI Indicator */}
        {showAIIndicator && pointsHistory?.[0]?.isAiGenerated && (
          <div className="aiIndicator">
            <Typography variant="caption">AI Detected</Typography>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Typography color="error" variant="caption">
            {error.points || error.levelProgress}
          </Typography>
        )}
      </StyledPointsCard>
    </ErrorBoundary>
  );
});

// Display name for debugging
PointsCard.displayName = 'PointsCard';

export default PointsCard;