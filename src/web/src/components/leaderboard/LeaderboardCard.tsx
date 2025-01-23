import React, { useCallback } from 'react'; // v18.0+
import { styled } from '@mui/material/styles'; // v5.0+
import { Typography } from '@mui/material'; // v5.0+
import Card from '../common/Card';
import Avatar from '../common/Avatar';
import { LeaderboardEntry } from '../../types/points.types';

// Props interface with accessibility features
interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  onClick: (entry: LeaderboardEntry) => void;
  highlighted?: boolean;
  className?: string;
  ariaLabel?: string;
}

// Styled components with accessibility and theme support
const StyledCard = styled(Card)<{ highlighted?: boolean }>(({ theme, highlighted }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2),
  gap: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  transition: 'all 0.2s ease-in-out',
  outline: 'none',
  cursor: 'pointer',

  '&:focus-visible': {
    outlineWidth: '2px',
    outlineStyle: 'solid',
    outlineColor: theme.palette.primary.main,
    outlineOffset: '2px',
  },

  ...(highlighted && {
    backgroundColor: theme.palette.primary.light,
    borderLeft: `4px solid ${theme.palette.primary.main}`,
  }),

  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

const RankNumber = styled(Typography)(({ theme }) => ({
  width: '32px',
  fontWeight: 'bold',
  color: theme.palette.text.primary,
  minWidth: '32px',
  textAlign: 'center',
}));

const UserInfo = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: '4px',
  marginLeft: '8px',
});

const PointsDisplay = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.primary.main,
  fontSize: '1.125rem',
  '@media (prefers-color-scheme: high-contrast)': {
    color: 'currentColor',
    borderBottom: '1px solid currentColor',
  },
}));

// Format points with accessibility considerations
const formatPoints = (points: number): string => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(points);
};

// Memoized LeaderboardCard component
const LeaderboardCard = React.memo<LeaderboardCardProps>(({
  entry,
  onClick,
  highlighted = false,
  className,
  ariaLabel,
}) => {
  // Memoized click handler
  const handleClick = useCallback(() => {
    onClick(entry);
  }, [onClick, entry]);

  return (
    <StyledCard
      className={className}
      highlighted={highlighted}
      interactive
      elevated={highlighted}
      onClick={handleClick}
      role="listitem"
      tabIndex={0}
      aria-label={ariaLabel || `${entry.displayName}, Rank ${entry.rank}, Level ${entry.level}, ${formatPoints(entry.totalPoints)} points`}
    >
      <RankNumber
        variant="body1"
        aria-hidden="true"
      >
        {entry.rank}
      </RankNumber>

      <Avatar
        name={entry.displayName}
        size="medium"
        ariaLabel={`${entry.displayName}'s avatar`}
      />

      <UserInfo>
        <Typography
          variant="h6"
          component="span"
          sx={{ fontWeight: 'medium' }}
        >
          {entry.displayName}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          component="span"
        >
          Level {entry.level}
        </Typography>
      </UserInfo>

      <PointsDisplay
        variant="body1"
        component="span"
        aria-label={`${formatPoints(entry.totalPoints)} points`}
      >
        {formatPoints(entry.totalPoints)} pts
      </PointsDisplay>
    </StyledCard>
  );
});

// Display name for debugging
LeaderboardCard.displayName = 'LeaderboardCard';

export default LeaderboardCard;