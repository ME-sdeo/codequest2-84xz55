/**
 * @fileoverview A reusable form input component implementing Material Design principles
 * with comprehensive validation, accessibility support, and security features.
 * @version 1.0.0
 */

import React from 'react'; // v18.0+
import { styled } from '@mui/material/styles'; // v5.0+
import { sanitizeInput } from '../../utils/validation.utils';

// Interface for component props with comprehensive type safety
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
  value: string;
  type?: string;
  placeholder?: string;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  pattern?: string;
  maxLength?: number;
}

// Styled component implementing Material Design 3 principles
const StyledInput = styled('input')(({ theme, error }) => ({
  width: '100%',
  padding: theme.spacing(1), // 8px based on spacing system
  border: `1px solid ${error ? '#D32F2F' : '#424242'}`,
  borderRadius: theme.spacing(1),
  fontSize: '1rem',
  fontFamily: 'Inter, sans-serif',
  backgroundColor: '#ffffff',
  color: '#424242',
  transition: 'all 0.2s ease-in-out',
  outline: 'none',
  
  '&:focus': {
    borderColor: error ? '#D32F2F' : '#1976D2',
    boxShadow: `0 0 0 2px ${error ? 'rgba(211, 47, 47, 0.2)' : 'rgba(25, 118, 210, 0.2)'}`,
  },
  
  '&:disabled': {
    backgroundColor: '#f5f5f5',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  
  '&::placeholder': {
    color: '#757575',
  },
  
  // High contrast for WCAG 2.1 AA compliance
  '@media (forced-colors: active)': {
    borderColor: 'CanvasText',
  },
}));

// Container for input and associated elements
const InputContainer = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px', // Half of the 8px spacing system
  width: '100%',
});

// Label component with proper contrast
const InputLabel = styled('label')(({ theme, error }) => ({
  color: error ? '#D32F2F' : '#424242',
  fontSize: '0.875rem',
  fontFamily: 'Inter, sans-serif',
  marginBottom: theme.spacing(0.5),
}));

// Helper text with error styling
const HelperText = styled('span')(({ theme, error }) => ({
  fontSize: '0.75rem',
  color: error ? '#D32F2F' : '#757575',
  marginTop: theme.spacing(0.5),
}));

/**
 * Enhanced input component with validation, accessibility, and Material Design implementation
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {
    id,
    name,
    value,
    type = 'text',
    placeholder,
    label,
    error,
    helperText,
    disabled,
    required,
    autoFocus,
    className,
    onChange,
    onBlur,
    onFocus,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    inputMode,
    pattern,
    maxLength,
    ...rest
  } = props;

  // State for internal value management
  const [internalValue, setInternalValue] = React.useState(value);
  
  // Debounce timer ref
  const debounceTimer = React.useRef<NodeJS.Timeout>();

  /**
   * Enhanced change handler with debouncing and sanitization
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    
    // Clear existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Sanitize input value
    const sanitizedValue = sanitizeInput(newValue);
    setInternalValue(sanitizedValue);

    // Debounce the onChange callback
    debounceTimer.current = setTimeout(() => {
      if (onChange) {
        const syntheticEvent = {
          ...event,
          target: {
            ...event.target,
            value: sanitizedValue,
          },
        };
        onChange(syntheticEvent);
      }
    }, 150);
  };

  // Generate unique IDs for accessibility
  const helperId = `${id}-helper`;
  const labelId = `${id}-label`;

  return (
    <InputContainer className={className}>
      {label && (
        <InputLabel
          htmlFor={id}
          id={labelId}
          error={error}
          required={required}
        >
          {label}
        </InputLabel>
      )}
      
      <StyledInput
        ref={ref}
        id={id}
        name={name}
        type={type}
        value={internalValue}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        error={error}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        aria-label={ariaLabel || label}
        aria-invalid={error}
        aria-required={required}
        aria-describedby={helperText ? helperId : ariaDescribedBy}
        {...rest}
      />
      
      {helperText && (
        <HelperText
          id={helperId}
          error={error}
          role={error ? 'alert' : 'status'}
        >
          {helperText}
        </HelperText>
      )}
    </InputContainer>
  );
});

Input.displayName = 'Input';

export default Input;