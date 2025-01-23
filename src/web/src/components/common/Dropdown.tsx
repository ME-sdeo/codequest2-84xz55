import React, { useState, useCallback, useRef, useEffect, memo } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.0
import { debounce } from 'lodash'; // v4.17.21
import { useVirtual } from 'react-virtual'; // v2.10.4
import { dropdown, 'dropdown-menu', 'dropdown-virtual' } from '../styles/components.css';
import Button from './Button';

// Interfaces
export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  groupId?: string;
  index?: number;
}

export interface DropdownGroup {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  groups?: DropdownGroup[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onSearchChange?: (searchValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  isMulti?: boolean;
  isSearchable?: boolean;
  isVirtual?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  label?: string;
  loadingMessage?: string;
  noOptionsMessage?: string;
  virtualItemSize?: number;
  ariaLabel?: string;
}

const Dropdown: React.FC<DropdownProps> = memo(({
  options,
  groups,
  value,
  onChange,
  onSearchChange,
  placeholder = 'Select an option',
  disabled = false,
  isLoading = false,
  isMulti = false,
  isSearchable = false,
  isVirtual = false,
  className,
  size = 'md',
  error,
  label,
  loadingMessage = 'Loading...',
  noOptionsMessage = 'No options available',
  virtualItemSize = 40,
  ariaLabel,
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<DropdownOption[]>(options);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scroll configuration
  const virtualizer = useVirtual({
    size: filteredOptions.length,
    parentRef: isVirtual ? parentRef : undefined,
    estimateSize: useCallback(() => virtualItemSize, [virtualItemSize]),
    overscan: 5,
  });

  // Handlers
  const handleToggle = useCallback(() => {
    if (!disabled && !isLoading) {
      setIsOpen(!isOpen);
      setSearchValue('');
      setFilteredOptions(options);
      setFocusedIndex(-1);
    }
  }, [disabled, isLoading, options]);

  const handleSearch = useCallback(
    debounce((value: string) => {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
      onSearchChange?.(value);
    }, 300),
    [options, onSearchChange]
  );

  const handleOptionSelect = useCallback((option: DropdownOption) => {
    if (option.disabled || groups?.find(g => g.id === option.groupId)?.disabled) {
      return;
    }

    if (isMulti) {
      const values = Array.isArray(value) ? value : [];
      const newValue = values.includes(option.value)
        ? values.filter(v => v !== option.value)
        : [...values, option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  }, [value, onChange, isMulti, groups]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0) {
          handleOptionSelect(filteredOptions[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [filteredOptions, focusedIndex, handleOptionSelect]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render methods
  const renderOption = (option: DropdownOption, index: number) => {
    const isSelected = Array.isArray(value) 
      ? value.includes(option.value)
      : value === option.value;
    
    return (
      <div
        key={option.value}
        className={classNames('dropdown__option', {
          'dropdown__option--selected': isSelected,
          'dropdown__option--focused': index === focusedIndex,
          'dropdown__option--disabled': option.disabled,
        })}
        onClick={() => handleOptionSelect(option)}
        role="option"
        aria-selected={isSelected}
        aria-disabled={option.disabled}
      >
        {option.icon && <span className="dropdown__option-icon">{option.icon}</span>}
        <span className="dropdown__option-label">{option.label}</span>
        {isSelected && (
          <span className="dropdown__option-check" aria-hidden="true">✓</span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={dropdownRef}
      className={classNames(
        'dropdown',
        `dropdown--${size}`,
        {
          'dropdown--open': isOpen,
          'dropdown--disabled': disabled,
          'dropdown--error': error,
          'dropdown--multi': isMulti,
        },
        className
      )}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-disabled={disabled}
      aria-label={ariaLabel}
    >
      {label && (
        <label className="dropdown__label" id={`${label}-label`}>
          {label}
        </label>
      )}
      
      <Button
        className="dropdown__trigger"
        variant="outlined"
        disabled={disabled}
        onClick={handleToggle}
        aria-labelledby={label ? `${label}-label` : undefined}
      >
        <span className="dropdown__trigger-text">
          {Array.isArray(value) && value.length > 0
            ? `${value.length} selected`
            : options.find(opt => opt.value === value)?.label || placeholder}
        </span>
        <span className="dropdown__trigger-icon" aria-hidden="true">▼</span>
      </Button>

      {isOpen && (
        <div 
          className="dropdown__menu"
          role="listbox"
          aria-multiselectable={isMulti}
          onKeyDown={handleKeyDown}
        >
          {isSearchable && (
            <input
              ref={searchInputRef}
              className="dropdown__search"
              type="text"
              value={searchValue}
              onChange={e => {
                setSearchValue(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Search..."
              aria-label="Search options"
            />
          )}

          {isLoading ? (
            <div className="dropdown__loading" role="status">
              {loadingMessage}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="dropdown__no-options" role="status">
              {noOptionsMessage}
            </div>
          ) : isVirtual ? (
            <div ref={parentRef} className="dropdown__virtual-container">
              <div
                style={{
                  height: `${virtualizer.totalSize}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.virtualItems.map(virtualRow => (
                  <div
                    key={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderOption(filteredOptions[virtualRow.index], virtualRow.index)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            filteredOptions.map((option, index) => renderOption(option, index))
          )}
        </div>
      )}

      {error && (
        <div className="dropdown__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});

Dropdown.displayName = 'Dropdown';

export default Dropdown;