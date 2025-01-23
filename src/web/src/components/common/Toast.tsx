import React from 'react'; // react v18.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import { Alert, Snackbar } from '@mui/material'; // @mui/material v5.0+
import { useMediaQuery } from '@mui/material'; // @mui/material v5.0+
import { lightTheme, darkTheme } from '../../config/theme.config';
import '../../styles/animations.css';

// Constants for configuration
const DEFAULT_AUTO_HIDE_DURATION = 5000;
const ANIMATION_DURATION = 250;
const REDUCED_MOTION_DURATION = 0;

// Default anchor origin following Material Design guidelines
const DEFAULT_ANCHOR_ORIGIN = {
  vertical: 'bottom' as const,
  horizontal: 'center' as const
};

// Interface for Toast component props
interface ToastProps {
  message: string;
  severity?: 'success' | 'info' | 'warning' | 'error';
  open: boolean;
  onClose: () => void;
  autoHideDuration?: number;
  anchorOrigin?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  variant?: 'filled' | 'outlined' | 'standard';
  enableReducedMotion?: boolean;
  rtl?: boolean;
  role?: 'alert' | 'status';
  disableWindowBlur?: boolean;
}

// Styled Alert component with performance optimizations
const StyledAlert = styled(Alert)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'light' 
    ? lightTheme.palette.primary.main 
    : darkTheme.palette.primary.dark,
  color: theme.palette.common.white,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  // Performance optimizations
  transform: 'translateZ(0)',
  willChange: 'transform, opacity',
  contain: 'layout, paint',
  // RTL support
  direction: 'inherit',
  '& .MuiAlert-icon': {
    marginRight: theme.direction === 'rtl' ? 0 : 12,
    marginLeft: theme.direction === 'rtl' ? 12 : 0,
  }
}));

// Memoized Toast component for performance
const Toast = React.memo<ToastProps>(({
  message,
  severity = 'info',
  open,
  onClose,
  autoHideDuration = DEFAULT_AUTO_HIDE_DURATION,
  anchorOrigin = DEFAULT_ANCHOR_ORIGIN,
  variant = 'filled',
  enableReducedMotion = false,
  rtl = false,
  role = 'alert',
  disableWindowBlur = false
}) => {
  // Check for reduced motion preference
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shouldReduceMotion = enableReducedMotion || prefersReducedMotion;

  // Animation duration based on motion preferences
  const animationDuration = shouldReduceMotion ? REDUCED_MOTION_DURATION : ANIMATION_DURATION;

  // Handle window blur/focus for autoHide
  React.useEffect(() => {
    if (!disableWindowBlur && open) {
      let timeoutId: number;
      
      const handleWindowBlur = () => {
        clearTimeout(timeoutId);
      };

      const handleWindowFocus = () => {
        timeoutId = window.setTimeout(onClose, autoHideDuration);
      };

      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);

      return () => {
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        clearTimeout(timeoutId);
      };
    }
  }, [open, autoHideDuration, onClose, disableWindowBlur]);

  // Get animation classes based on RTL and motion preferences
  const getAnimationClass = (isEntering: boolean): string => {
    if (shouldReduceMotion) return isEntering ? 'animate-fade-in' : 'animate-fade-out';
    
    if (rtl) {
      return isEntering ? 'animate-slide-in-rtl' : 'animate-slide-out-rtl';
    }
    
    return isEntering ? 'animate-slide-in' : 'animate-slide-out';
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      TransitionProps={{
        timeout: animationDuration,
        onEnter: (node) => {
          node.classList.add(getAnimationClass(true));
        },
        onExit: (node) => {
          node.classList.add(getAnimationClass(false));
        }
      }}
    >
      <StyledAlert
        severity={severity}
        variant={variant}
        onClose={onClose}
        role={role}
        sx={{ 
          direction: rtl ? 'rtl' : 'ltr',
          minWidth: '200px',
          maxWidth: '600px'
        }}
        // Accessibility enhancements
        aria-live={severity === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        {message}
      </StyledAlert>
    </Snackbar>
  );
});

// Display name for debugging
Toast.displayName = 'Toast';

export default Toast;