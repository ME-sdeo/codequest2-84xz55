import React, { useState, useCallback, useMemo, useRef, memo } from 'react'; // react v18.0+
import { Select as MuiSelect, MenuItem, FormControl, InputLabel, CircularProgress } from '@mui/material'; // @mui/material v5.0+
import { useTheme } from '@mui/material/styles'; // @mui/material v5.0+
import debounce from 'lodash/debounce'; // lodash v4.17+
import { lightTheme, darkTheme } from '../../config/theme.config';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  data?: any;
  groupId?: string;
  icon?: React.ReactNode;
}

export interface SelectProps {
  id: string;
  name: string;
  label: string;
  options: SelectOption[];
  value: string | string[];
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  loading?: boolean;
  maxItems?: number;
  style?: React.CSSProperties;
  className?: string;
  onSearch?: (query: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

const useSelectKeyboardNavigation = (
  options: SelectOption[],
  isOpen: boolean
) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => 
            prev < options.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => 
            prev > 0 ? prev - 1 : options.length - 1
          );
          break;
        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusedIndex(options.length - 1);
          break;
      }
    },
    [isOpen, options.length]
  );

  return { focusedIndex, handleKeyDown };
};

const Select = memo(({
  id,
  name,
  label,
  options,
  value,
  multiple = false,
  disabled = false,
  required = false,
  error = false,
  helperText,
  onChange,
  placeholder,
  searchable = false,
  loading = false,
  maxItems,
  style,
  className,
  onSearch,
  onOpen,
  onClose,
  startAdornment,
  endAdornment,
}: SelectProps) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { focusedIndex, handleKeyDown } = useSelectKeyboardNavigation(
    options,
    isOpen
  );

  const handleSearchDebounced = useMemo(
    () =>
      debounce((query: string) => {
        onSearch?.(query);
      }, 300),
    [onSearch]
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const query = event.target.value;
      setSearchQuery(query);
      handleSearchDebounced(query);
    },
    [handleSearchDebounced]
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchable, searchQuery]);

  const handleChange = useCallback(
    (event: any) => {
      const newValue = event.target.value;
      onChange(newValue);
    },
    [onChange]
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    onClose?.();
  }, [onClose]);

  const renderValue = useCallback((selected: any) => {
    if (!selected || (Array.isArray(selected) && selected.length === 0)) {
      return <em>{placeholder || 'Select an option'}</em>;
    }

    if (multiple) {
      const selectedOptions = options.filter((option) =>
        selected.includes(option.value)
      );
      return selectedOptions.map((option) => option.label).join(', ');
    }

    const selectedOption = options.find((option) => option.value === selected);
    return selectedOption?.label || '';
  }, [multiple, options, placeholder]);

  return (
    <FormControl
      fullWidth
      error={error}
      disabled={disabled}
      required={required}
      className={className}
      style={{
        ...styles.root,
        ...style,
      }}
    >
      <InputLabel
        id={`${id}-label`}
        style={styles.label}
        shrink={!!value || isOpen}
      >
        {label}
      </InputLabel>
      <MuiSelect
        id={id}
        name={name}
        labelId={`${id}-label`}
        value={value}
        multiple={multiple}
        onChange={handleChange}
        onOpen={handleOpen}
        onClose={handleClose}
        onKeyDown={handleKeyDown}
        renderValue={renderValue}
        displayEmpty
        style={styles.select}
        startAdornment={startAdornment}
        endAdornment={
          <>
            {loading && (
              <CircularProgress
                size={20}
                style={{ marginRight: theme.spacing(1) }}
              />
            )}
            {endAdornment}
          </>
        }
        MenuProps={{
          PaperProps: {
            style: styles.menu,
          },
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
        }}
      >
        {searchable && (
          <div style={styles.searchInput}>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onClick={(e) => e.stopPropagation()}
              placeholder="Search..."
              style={{
                width: '100%',
                border: 'none',
                padding: theme.spacing(1),
                background: 'transparent',
              }}
            />
          </div>
        )}
        {loading ? (
          <div style={styles.loading}>
            <CircularProgress size={24} />
          </div>
        ) : (
          filteredOptions.map((option, index) => (
            <MenuItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              style={{
                ...styles.menuItem,
                backgroundColor:
                  focusedIndex === index
                    ? theme.palette.action.hover
                    : 'transparent',
              }}
            >
              {option.icon && (
                <span style={{ marginRight: theme.spacing(1) }}>
                  {option.icon}
                </span>
              )}
              {option.label}
            </MenuItem>
          ))
        )}
      </MuiSelect>
      {helperText && (
        <div
          style={{
            ...styles.helperText,
            color: error
              ? theme.palette.error.main
              : theme.palette.text.secondary,
          }}
        >
          {helperText}
        </div>
      )}
    </FormControl>
  );
});

const styles = {
  root: {
    width: '100%',
    minWidth: 120,
    position: 'relative' as const,
  },
  label: {
    color: 'var(--color-text-primary)',
    fontWeight: 500,
    marginBottom: '8px',
  },
  select: {
    padding: '8px 16px',
    borderRadius: '4px',
  },
  menu: {
    maxHeight: 300,
    overflowY: 'auto' as const,
  },
  menuItem: {
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    padding: '4px 8px',
    margin: '4px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
  },
  helperText: {
    marginTop: '4px',
    fontSize: '0.75rem',
  },
  loading: {
    minHeight: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

Select.displayName = 'Select';

export default Select;