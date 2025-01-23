import React, { useCallback } from 'react'; // react v18.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import Paper from '@mui/material/Paper'; // @mui/material v5.0+
import { lightTheme, darkTheme } from '../../config/theme.config';

// Interface for Card component props
interface CardProps {
  children: React.ReactNode;
  elevated?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  role?: string;
  tabIndex?: number;
  ariaLabel?: string;
  highContrast?: boolean;
}

// Styled Paper component with theme integration
const StyledCard = styled(Paper, {
  shouldForwardProp: (prop) => 
    !['elevated', 'interactive', 'highContrast'].includes(prop as string),
})<{
  elevated?: boolean;
  interactive?: boolean;
  highContrast?: boolean;
}>(({ theme, elevated, interactive, highContrast }) => ({
  background: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  transition: 'all 0.2s ease-in-out',
  position: 'relative',
  outline: 'none',
  direction: 'inherit',

  // Elevation styles
  ...(elevated && {
    boxShadow: theme.shadows[3],
  }),

  // Interactive styles
  ...(interactive && {
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  }),

  // High contrast styles
  ...(highContrast && {
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: 'none',
    background: theme.palette.background.default,
  }),

  // Accessibility enhancements
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover': {
      transform: 'none',
    },
  },
}));

// Memoized Card component
const Card = React.memo<CardProps>(({
  children,
  elevated = false,
  interactive = false,
  className,
  onClick,
  role = 'region',
  tabIndex,
  ariaLabel,
  highContrast = false,
}) => {
  // Memoized click handler
  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      onClick(event);
    }
  }, [onClick]);

  return (
    <StyledCard
      className={className}
      elevated={elevated}
      interactive={interactive}
      highContrast={highContrast}
      onClick={interactive ? handleClick : undefined}
      role={role}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      aria-label={ariaLabel}
      component="div"
      elevation={0} // Using custom elevation through styled component
    >
      {children}
    </StyledCard>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;