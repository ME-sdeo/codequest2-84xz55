import React from 'react'; // v18.0+
import { styled } from '@mui/material/styles'; // v5.0+
import { Avatar as MuiAvatar } from '@mui/material'; // v5.0+
import { lightTheme } from '../../config/theme.config';

// Props interface with comprehensive options for customization
interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'small' | 'medium' | 'large';
  clickable?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  testId?: string;
}

// Styled component extending MUI Avatar with enhanced visual features
const StyledAvatar = styled(MuiAvatar, {
  shouldForwardProp: (prop) => 
    !['size', 'clickable'].includes(prop as string),
})<{ size?: string; clickable?: boolean }>(({ theme, size, clickable }) => ({
  border: `2px solid ${theme.palette.background.paper}`,
  cursor: clickable ? 'pointer' : 'default',
  transition: 'all 0.2s ease-in-out',
  width: size === 'small' ? '32px' : size === 'large' ? '48px' : '40px',
  height: size === 'small' ? '32px' : size === 'large' ? '48px' : '40px',
  fontSize: size === 'small' ? '14px' : size === 'large' ? '20px' : '16px',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  
  '&:hover': {
    transform: clickable ? 'scale(1.1)' : 'none',
    boxShadow: clickable ? theme.shadows[2] : 'none',
  },
  
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover': {
      transform: 'none',
    },
  },
}));

// Utility function to extract initials from name
const getInitials = (name?: string): string => {
  if (!name?.trim()) return '';
  
  const nameParts = name.trim().split(/\s+/);
  const firstInitial = nameParts[0]?.[0] || '';
  const lastInitial = nameParts[nameParts.length - 1]?.[0] || '';
  
  return (firstInitial + (nameParts.length > 1 ? lastInitial : ''))
    .toUpperCase()
    .slice(0, 2);
};

// Main Avatar component with enhanced accessibility and interaction features
const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  name,
  size = 'medium',
  clickable = false,
  onClick,
  ariaLabel,
  testId = 'avatar',
}) => {
  const initials = React.useMemo(() => getInitials(name), [name]);
  
  return (
    <StyledAvatar
      src={src}
      alt={alt || name || 'User avatar'}
      size={size}
      clickable={clickable}
      onClick={clickable ? onClick : undefined}
      aria-label={ariaLabel || alt || name || 'User avatar'}
      data-testid={testId}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyPress={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      {!src && initials}
    </StyledAvatar>
  );
};

export default Avatar;