import React from 'react'; // react v18.0+
import { Grid } from '@mui/material'; // @mui/material v5.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import BadgeCard from './BadgeCard';

// Styled components for layout and messaging
const StyledGridContainer = styled('div')(({ theme }) => ({
  width: '100%',
  margin: '0 auto',
  padding: theme.spacing(3),
  minHeight: '200px',
  position: 'relative',
}));

const StyledEmptyMessage = styled('div')(({ theme }) => ({
  textAlign: 'center',
  color: theme.palette.text.secondary,
  padding: theme.spacing(4),
  width: '100%',
  fontSize: theme.typography.body1.fontSize,
}));

const StyledErrorMessage = styled('div')(({ theme }) => ({
  textAlign: 'center',
  color: theme.palette.error.main,
  padding: theme.spacing(2),
  width: '100%',
}));

const StyledSkeletonContainer = styled('div')(({ theme }) => ({
  width: '100%',
  height: '200px',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
}));

// Interface for badge data structure
interface Badge {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pointsRequired: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  category?: string;
}

// Props interface for the BadgeGrid component
interface BadgeGridProps {
  badges: Badge[];
  spacing: number;
  columns: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  onBadgeClick?: (badgeId: string) => void;
  loading?: boolean;
  error?: string;
}

// Memoized BadgeGrid component
const BadgeGrid = React.memo<BadgeGridProps>(({
  badges,
  spacing,
  columns,
  onBadgeClick,
  loading = false,
  error,
}) => {
  // Early return for loading state
  if (loading) {
    return (
      <StyledGridContainer>
        <StyledSkeletonContainer role="progressbar" aria-label="Loading badges" />
      </StyledGridContainer>
    );
  }

  // Early return for error state
  if (error) {
    return (
      <StyledGridContainer>
        <StyledErrorMessage role="alert">
          {error}
        </StyledErrorMessage>
      </StyledGridContainer>
    );
  }

  // Early return for empty badges array
  if (!badges.length) {
    return (
      <StyledGridContainer>
        <StyledEmptyMessage role="status">
          No badges available at this time.
        </StyledEmptyMessage>
      </StyledGridContainer>
    );
  }

  // Handle badge click with keyboard support
  const handleBadgeClick = (badgeId: string) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'click' ||
      (event.type === 'keydown' && (event as React.KeyboardEvent).key === 'Enter')
    ) {
      onBadgeClick?.(badgeId);
    }
  };

  return (
    <StyledGridContainer>
      <Grid
        container
        spacing={spacing}
        role="grid"
        aria-label="Achievement badges grid"
      >
        {badges.map((badge) => (
          <Grid
            item
            key={badge.id}
            xs={12 / columns.xs}
            sm={12 / columns.sm}
            md={12 / columns.md}
            lg={12 / columns.lg}
            xl={12 / columns.xl}
            role="gridcell"
          >
            <BadgeCard
              id={badge.id}
              title={badge.title}
              description={badge.description}
              imageUrl={badge.imageUrl}
              pointsRequired={badge.pointsRequired}
              isUnlocked={badge.isUnlocked}
              unlockedAt={badge.unlockedAt}
              altText={`${badge.title} achievement badge`}
              onImageError={(error) => console.error('Badge image loading error:', error)}
              analytics={{
                category: 'Badges',
                action: 'View',
                label: badge.category
              }}
              i18n={{
                locale: 'en',
                direction: 'ltr',
                translations: {
                  pointsRequired: 'Points Required',
                  unlockedAt: 'Unlocked'
                }
              }}
            />
          </Grid>
        ))}
      </Grid>
    </StyledGridContainer>
  );
});

// Display name for debugging
BadgeGrid.displayName = 'BadgeGrid';

export default BadgeGrid;