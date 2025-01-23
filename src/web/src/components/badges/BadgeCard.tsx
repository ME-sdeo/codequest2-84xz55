import React, { useCallback } from 'react'; // react v18.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import { Typography, useMediaQuery } from '@mui/material'; // @mui/material v5.0+
import { ErrorBoundary } from 'react-error-boundary'; // react-error-boundary v4.0.0+
import Card from '../common/Card';

// Props interface for the BadgeCard component
interface BadgeProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pointsRequired: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  altText: string;
  onImageError?: (error: Error) => void;
  analytics?: {
    category: string;
    action: string;
    label?: string;
  };
  i18n?: {
    locale: string;
    direction: 'ltr' | 'rtl';
    translations: {
      pointsRequired: string;
      unlockedAt: string;
    };
  };
}

// Styled components
const StyledBadgeImage = styled('img')(({ theme, isUnlocked }) => ({
  width: '64px',
  height: '64px',
  marginInlineEnd: theme.spacing(2),
  marginBlock: theme.spacing(2),
  opacity: isUnlocked ? 1 : 0.5,
  transition: theme.transitions.create(['opacity', 'transform'], {
    duration: theme.transitions.duration.shorter,
  }),
  loading: 'lazy',
  objectFit: 'contain',
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

const StyledBadgeTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBlockEnd: theme.spacing(1),
  color: theme.palette.text.primary,
  textAlign: 'start',
}));

const StyledBadgeDescription = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  marginBlockEnd: theme.spacing(2),
  textAlign: 'start',
}));

const StyledBadgeStatus = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'isUnlocked',
})<{ isUnlocked: boolean }>(({ theme, isUnlocked }) => ({
  fontSize: '0.75rem',
  color: isUnlocked ? theme.palette.success.main : theme.palette.text.disabled,
  textAlign: 'start',
  direction: 'inherit',
}));

// Fallback component for image loading errors
const ImageErrorFallback = styled('div')(({ theme }) => ({
  width: '64px',
  height: '64px',
  backgroundColor: theme.palette.action.disabledBackground,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: theme.shape.borderRadius,
}));

// Memoized BadgeCard component
const BadgeCard = React.memo<BadgeProps>(({
  id,
  title,
  description,
  imageUrl,
  pointsRequired,
  isUnlocked,
  unlockedAt,
  altText,
  onImageError,
  analytics,
  i18n = { locale: 'en', direction: 'ltr', translations: { pointsRequired: 'Points Required', unlockedAt: 'Unlocked' } },
}) => {
  // Check for high contrast mode
  const preferHighContrast = useMediaQuery('(prefers-contrast: more)');

  // Handle image loading error
  const handleImageError = useCallback((error: Error) => {
    console.error('Badge image loading failed:', error);
    onImageError?.(error);
  }, [onImageError]);

  // Track badge view for analytics
  React.useEffect(() => {
    if (analytics) {
      // Implement analytics tracking here
      const { category, action, label } = analytics;
      // Example: trackEvent(category, action, label);
    }
  }, [analytics]);

  // Format date for unlocked badges
  const formatUnlockDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString(i18n.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [i18n.locale]);

  return (
    <Card
      elevated={isUnlocked}
      interactive={isUnlocked}
      highContrast={preferHighContrast}
      role="article"
      aria-label={`${title} badge`}
      className={`badge-card-${id}`}
    >
      <div style={{ display: 'flex', direction: i18n.direction }}>
        <ErrorBoundary
          fallback={<ImageErrorFallback aria-hidden="true" />}
          onError={handleImageError}
        >
          <StyledBadgeImage
            src={imageUrl}
            alt={altText}
            isUnlocked={isUnlocked}
            loading="lazy"
            aria-hidden="true"
          />
        </ErrorBoundary>
        
        <div style={{ flex: 1 }}>
          <StyledBadgeTitle variant="h6">
            {title}
          </StyledBadgeTitle>
          
          <StyledBadgeDescription>
            {description}
          </StyledBadgeDescription>
          
          <StyledBadgeStatus isUnlocked={isUnlocked}>
            {isUnlocked
              ? `${i18n.translations.unlockedAt}: ${formatUnlockDate(unlockedAt!)}`
              : `${i18n.translations.pointsRequired}: ${pointsRequired}`
            }
          </StyledBadgeStatus>
        </div>
      </div>
    </Card>
  );
});

// Display name for debugging
BadgeCard.displayName = 'BadgeCard';

export default BadgeCard;