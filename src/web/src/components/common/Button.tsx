import React from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.0
import { button } from '../styles/components.css';

interface ButtonProps {
  /** The content to be rendered inside the button */
  children: React.ReactNode;
  /** Button variant following Material Design 3 */
  variant?: 'primary' | 'secondary' | 'danger' | 'outlined';
  /** Button size with mobile-optimized touch targets */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Accessible label */
  ariaLabel?: string;
  /** Text direction */
  dir?: 'ltr' | 'rtl';
  /** RTL support flag */
  isRTL?: boolean;
}

/**
 * Enhanced button component following Material Design 3 principles
 * with accessibility, RTL support, and loading states
 */
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled = false,
  isLoading = false,
  type = 'button',
  onClick,
  ariaLabel,
  dir,
  isRTL = false,
}) => {
  /**
   * Generates button CSS classes with RTL and loading state support
   */
  const getButtonClasses = (): string => {
    return classNames(
      'button',
      `button--${variant}`,
      {
        'button--sm': size === 'sm',
        'button--md': size === 'md',
        'button--lg': size === 'lg',
        'button--disabled': disabled,
        'button--loading': isLoading,
        'button--rtl': isRTL || dir === 'rtl',
        'gpu-accelerated': true,
      },
      className
    );
  };

  /**
   * Handles keyboard interaction for accessibility
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      !disabled && !isLoading && onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  };

  return (
    <button
      type={type}
      className={getButtonClasses()}
      onClick={!disabled && !isLoading ? onClick : undefined}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-label={ariaLabel}
      dir={dir}
      onKeyDown={handleKeyDown}
      style={{
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {isLoading ? (
        <span className="button__loading-indicator" aria-hidden="true">
          <svg
            className="button__spinner"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="button__spinner-track"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              opacity="0.25"
            />
            <circle
              className="button__spinner-head"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="30"
              strokeDashoffset="30"
            />
          </svg>
          <span className="button__loading-text">Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export type { ButtonProps };
export default Button;