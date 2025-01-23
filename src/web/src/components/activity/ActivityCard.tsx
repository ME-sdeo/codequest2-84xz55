import React, { useCallback, useMemo } from 'react';
import { Typography, Box, Chip, IconButton, Skeleton } from '@mui/material'; // @mui/material v5.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import { Activity, ActivityType, ActivityDisplayConfig } from '../../types/activity.types';
import { ACTIVITY_DISPLAY_CONFIG, AI_POINT_MODIFIER } from '../../constants/activity.constants';
import Card from '../common/Card';

// Props interface with enhanced accessibility support
interface ActivityCardProps {
  activity: Activity;
  onClick?: (activity: Activity) => void;
  elevated?: boolean;
  className?: string;
  loading?: boolean;
  highContrast?: boolean;
  dir?: 'ltr' | 'rtl';
}

// Styled components with RTL and high contrast support
const StyledCardContent = styled(Box, {
  shouldForwardProp: (prop) => !['dir', 'highContrast'].includes(prop as string),
})<{ dir?: 'ltr' | 'rtl'; highContrast?: boolean }>(({ theme, dir, highContrast }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  direction: dir || 'ltr',
  
  '& .header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  
  '& .metadata': {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  
  '& .points': {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: highContrast ? theme.palette.text.primary : theme.palette.primary.main,
  },
  
  '& .ai-badge': {
    backgroundColor: highContrast 
      ? theme.palette.error.dark 
      : theme.palette.error.light,
    color: theme.palette.error.contrastText,
  },
}));

const ActivityCard: React.FC<ActivityCardProps> = React.memo(({
  activity,
  onClick,
  elevated = false,
  className,
  loading = false,
  highContrast = false,
  dir = 'ltr',
}) => {
  // Calculate final points with AI modifier
  const finalPoints = useMemo(() => {
    const basePoints = activity.points;
    return activity.isAiGenerated ? basePoints * AI_POINT_MODIFIER.MULTIPLIER : basePoints;
  }, [activity.points, activity.isAiGenerated]);

  // Get activity display configuration
  const displayConfig = ACTIVITY_DISPLAY_CONFIG[activity.type];

  // Memoized click handler
  const handleClick = useCallback(() => {
    onClick?.(activity);
  }, [onClick, activity]);

  // Loading state
  if (loading) {
    return (
      <Card elevated={elevated} className={className} highContrast={highContrast}>
        <StyledCardContent dir={dir} highContrast={highContrast}>
          <Box className="header">
            <Skeleton variant="text" width={150} height={24} />
            <Skeleton variant="circular" width={40} height={40} />
          </Box>
          <Box className="metadata">
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </Box>
          <Box className="points">
            <Skeleton variant="text" width={80} />
          </Box>
        </StyledCardContent>
      </Card>
    );
  }

  return (
    <Card
      elevated={elevated}
      className={className}
      interactive={Boolean(onClick)}
      onClick={handleClick}
      highContrast={highContrast}
      role="article"
      aria-label={`${displayConfig.displayName} activity with ${finalPoints} points`}
    >
      <StyledCardContent dir={dir} highContrast={highContrast}>
        <Box className="header">
          <Typography
            variant="h6"
            component="h3"
            sx={{ fontWeight: 'medium' }}
          >
            {displayConfig.displayName}
          </Typography>
          <IconButton
            aria-label={`${displayConfig.displayName} icon`}
            size="small"
            disabled
          >
            <span className={`icon ${displayConfig.icon}`} aria-hidden="true" />
          </IconButton>
        </Box>

        <Box className="metadata">
          <Typography variant="body1">
            {activity.metadata.title}
          </Typography>
          {activity.metadata.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ wordBreak: 'break-word' }}
            >
              {activity.metadata.description}
            </Typography>
          )}
        </Box>

        <Box className="points">
          <Typography variant="subtitle1" fontWeight="bold">
            {finalPoints} points
          </Typography>
          {activity.isAiGenerated && (
            <Chip
              label="AI Generated"
              size="small"
              className="ai-badge"
              aria-label="AI generated code detected"
            />
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ marginLeft: 'auto' }}
          >
            {new Date(activity.timestamp).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Typography>
        </Box>
      </StyledCardContent>
    </Card>
  );
});

ActivityCard.displayName = 'ActivityCard';

export default ActivityCard;