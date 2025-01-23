import React, { useCallback, useMemo } from 'react'; // react v18.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import { Typography, Box, Skeleton } from '@mui/material'; // @mui/material v5.0+
import Card from '../common/Card';
import Avatar from '../common/Avatar';
import { Team } from '../../types/team.types';

// Props interface with comprehensive type definitions
interface TeamCardProps {
  team: Team;
  onClick: (team: Team) => void;
  className?: string;
  elevated?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  dataTestId?: string;
}

// Styled components for layout and responsiveness
const StyledTeamCard = styled(Card)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  
  '&:hover': {
    transform: 'translateY(-2px)',
  },
  
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  
  "[dir='rtl'] &": {
    textAlign: 'right',
  },
  
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover': {
      transform: 'none',
    },
  },
}));

const TeamHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  
  "[dir='rtl'] &": {
    flexDirection: 'row-reverse',
  },
}));

const TeamStats = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: theme.spacing(1),
  
  '@media (max-width: 600px)': {
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
}));

// Memoized formatter for team points
const formatTeamPoints = (points: number, locale: string = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    useGrouping: true,
  }).format(points);
};

// Memoized TeamCard component with accessibility features
const TeamCard = React.memo<TeamCardProps>(({
  team,
  onClick,
  className,
  elevated = false,
  loading = false,
  ariaLabel,
  dataTestId = 'team-card',
}) => {
  // Memoized click handler
  const handleClick = useCallback(() => {
    onClick(team);
  }, [onClick, team]);

  // Memoized formatted points
  const formattedPoints = useMemo(() => 
    formatTeamPoints(team.totalPoints),
    [team.totalPoints]
  );

  // Loading state rendering
  if (loading) {
    return (
      <StyledTeamCard
        elevated={elevated}
        className={className}
        data-testid={`${dataTestId}-loading`}
        interactive={false}
      >
        <TeamHeader>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="text" width="60%" height={24} />
        </TeamHeader>
        <TeamStats>
          <Skeleton variant="text" width="40%" height={20} />
          <Skeleton variant="text" width="30%" height={20} />
        </TeamStats>
      </StyledTeamCard>
    );
  }

  return (
    <StyledTeamCard
      elevated={elevated}
      className={className}
      onClick={handleClick}
      interactive
      role="button"
      tabIndex={0}
      aria-label={ariaLabel || `Team ${team.name} with ${team.memberCount} members and ${formattedPoints} points`}
      data-testid={dataTestId}
      onKeyPress={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <TeamHeader>
        <Avatar
          name={team.name}
          size="medium"
          ariaLabel={`${team.name} team avatar`}
          testId={`${dataTestId}-avatar`}
        />
        <Typography
          variant="h6"
          component="h3"
          noWrap
          sx={{
            fontWeight: 600,
            flex: 1,
            minWidth: 0,
          }}
        >
          {team.name}
        </Typography>
      </TeamHeader>
      
      <TeamStats>
        <Typography
          variant="body1"
          color="text.secondary"
          component="p"
          aria-label={`${formattedPoints} total points`}
        >
          {formattedPoints} points
        </Typography>
        
        <Typography
          variant="body2"
          color="text.secondary"
          component="p"
          aria-label={`${team.memberCount} team members`}
        >
          {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
        </Typography>
      </TeamStats>
    </StyledTeamCard>
  );
});

// Display name for debugging
TeamCard.displayName = 'TeamCard';

export default TeamCard;