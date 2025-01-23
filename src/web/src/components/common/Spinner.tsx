import React, { memo } from 'react'; // v18.0+
import '../../styles/animations.css';

interface SpinnerProps {
  /**
   * Controls spinner size using predefined values or custom sizes
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large' | string;
  
  /**
   * Theme-aware color selection with custom color support
   * @default 'primary'
   */
  color?: 'primary' | 'secondary' | string;
  
  /**
   * Optional additional CSS classes for customization
   */
  className?: string;
  
  /**
   * Customizable accessibility label
   * @default 'Loading'
   */
  ariaLabel?: string;
}

/**
 * A performant and accessible loading spinner component following Material Design principles.
 * Features hardware acceleration, theme support, and respects reduced motion preferences.
 */
export const Spinner = memo(({
  size = 'medium',
  color = 'primary',
  className = '',
  ariaLabel = 'Loading'
}: SpinnerProps): JSX.Element => {
  // Size mapping following design system specifications
  const sizeMap = {
    small: '16px',
    medium: '24px',
    large: '32px'
  };

  // Theme-aware color mapping
  const colorMap = {
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)'
  };

  // Calculate final size and color values
  const finalSize = sizeMap[size as keyof typeof sizeMap] || size;
  const finalColor = colorMap[color as keyof typeof colorMap] || color;

  // Combine base styles with custom classes
  const spinnerClasses = `animate-spin ${className}`.trim();

  // Style object with performance optimizations
  const spinnerStyles: React.CSSProperties = {
    width: finalSize,
    height: finalSize,
    color: finalColor,
    willChange: 'transform',
    transform: 'translateZ(0)',
    contain: 'layout paint',
    backfaceVisibility: 'hidden'
  };

  return (
    <svg
      className={spinnerClasses}
      style={spinnerStyles}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="progressbar"
      aria-label={ariaLabel}
      aria-live="polite"
      data-testid="spinner"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="32"
        strokeLinecap="round"
        opacity="0.25"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="32"
        strokeDashoffset="32"
        strokeLinecap="round"
      />
    </svg>
  );
});

// Display name for debugging
Spinner.displayName = 'Spinner';

export default Spinner;