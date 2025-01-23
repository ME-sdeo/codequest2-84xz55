import React, { useEffect, useCallback, useRef } from 'react'; // react v18.0+
import { styled } from '@mui/material/styles'; // @mui/material v5.0+
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'; // @mui/material v5.0+
import { IconButton, Typography } from '@mui/material'; // @mui/material v5.0+
import { Close as CloseIcon } from '@mui/icons-material'; // @mui/icons-material v5.0+
import { lightTheme, darkTheme } from '../../config/theme.config';
import '../../styles/animations.css';

// Interface for Modal component props
interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  fullWidth?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disableBackdropClick?: boolean;
  disableEscapeKeyDown?: boolean;
  actions?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  disableAnimation?: boolean;
  animationDuration?: number;
  keepMounted?: boolean;
  onExited?: () => void;
  onEntered?: () => void;
}

// Styled components with Material Design 3 principles
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backdropFilter: 'blur(4px)',
    backgroundColor: theme.palette.mode === 'light' 
      ? 'rgba(255, 255, 255, 0.95)'
      : 'rgba(30, 30, 30, 0.95)',
    borderRadius: theme.spacing(1),
    boxShadow: theme.shadows[8],
    padding: 0,
    margin: theme.spacing(2),
    transform: 'translateZ(0)', // Hardware acceleration
    willChange: 'transform, opacity',
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    
    // WCAG 2.1 AA focus visibility
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  },
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(2, 3),
  color: theme.palette.text.primary,
  '& .MuiTypography-root': {
    fontFamily: theme.typography.fontFamily,
    fontWeight: theme.typography.fontWeightMedium,
  },
}));

const StyledCloseButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,
  padding: theme.spacing(1),
  marginLeft: theme.spacing(1),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  // Ensure minimum touch target size for accessibility
  '@media (pointer: coarse)': {
    minWidth: '44px',
    minHeight: '44px',
  },
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  // Ensure proper content spacing
  '&:first-of-type': {
    paddingTop: theme.spacing(2),
  },
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  // Add spacing between action buttons
  '& > :not(:first-of-type)': {
    marginLeft: theme.spacing(2),
  },
}));

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  children,
  onClose,
  fullWidth = true,
  maxWidth = 'sm',
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  actions,
  ariaLabel,
  className,
  disableAnimation = false,
  animationDuration = 200,
  keepMounted = false,
  onExited,
  onEntered,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Handle backdrop click with debouncing
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !disableBackdropClick) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }, [disableBackdropClick, onClose]);

  // Handle escape key press
  const handleEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !disableEscapeKeyDown) {
      event.preventDefault();
      onClose();
    }
  }, [disableEscapeKeyDown, onClose]);

  // Manage focus and keyboard events
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      // Focus trap setup
      const focusableElements = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements?.length) {
        (focusableElements[0] as HTMLElement).focus();
      }

      // Add keyboard event listener
      document.addEventListener('keydown', handleEscapeKeyDown);
    } else {
      // Restore focus when modal closes
      previousFocus.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKeyDown);
    };
  }, [open, handleEscapeKeyDown]);

  return (
    <StyledDialog
      open={open}
      ref={dialogRef}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      keepMounted={keepMounted}
      onClose={handleBackdropClick}
      className={`${className} ${!disableAnimation ? 'animate-fade-in animate-scale-in' : ''}`}
      TransitionProps={{
        timeout: animationDuration,
        onExited,
        onEntered,
      }}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      aria-label={ariaLabel}
    >
      <StyledDialogTitle id="modal-title">
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <StyledCloseButton
          onClick={onClose}
          aria-label="Close modal"
          edge="end"
        >
          <CloseIcon />
        </StyledCloseButton>
      </StyledDialogTitle>

      <StyledDialogContent id="modal-description">
        {children}
      </StyledDialogContent>

      {actions && (
        <StyledDialogActions>
          {actions}
        </StyledDialogActions>
      )}
    </StyledDialog>
  );
};

export type { ModalProps };