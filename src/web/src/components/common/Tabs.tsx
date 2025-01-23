import React, { useState, useCallback, useRef, useEffect } from 'react'; // react v18.0+
import { Tabs as MuiTabs, Tab, Box } from '@mui/material'; // @mui/material v5.0+
import { lightTheme } from '../../config/theme.config';

// Interfaces
export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  tooltip?: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultTab?: number;
  onChange?: (index: number) => void;
  ariaLabel?: string;
  centered?: boolean;
  vertical?: boolean;
  className?: string;
  scrollable?: boolean;
  lazyLoad?: boolean;
  transitionProps?: {
    timeout?: number;
    easing?: string;
  };
  variant?: 'standard' | 'scrollable' | 'fullWidth';
}

// Accessibility helper function
const a11yProps = (index: number, vertical?: boolean, customId?: string) => {
  const baseId = customId || `tab-${index}`;
  return {
    id: `${baseId}`,
    'aria-controls': `${baseId}-panel`,
    role: 'tab',
    tabIndex: 0,
    'aria-orientation': vertical ? 'vertical' : 'horizontal',
    'aria-selected': false,
  };
};

// Tab Panel component with performance optimization
const TabPanel = React.memo(({
  children,
  value,
  index,
  lazyLoad,
  ...other
}: {
  children: React.ReactNode;
  value: number;
  index: number;
  lazyLoad?: boolean;
}) => {
  const isVisible = value === index;
  const hasBeenVisible = useRef(false);

  useEffect(() => {
    if (isVisible) {
      hasBeenVisible.current = true;
    }
  }, [isVisible]);

  if (lazyLoad && !hasBeenVisible.current && !isVisible) {
    return null;
  }

  return (
    <Box
      role="tabpanel"
      hidden={!isVisible}
      id={`tab-${index}-panel`}
      aria-labelledby={`tab-${index}`}
      sx={{
        padding: lightTheme.spacing(3),
        transition: 'opacity 0.3s ease',
        opacity: isVisible ? 1 : 0,
        height: '100%',
        ...(!isVisible && {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          visibility: 'hidden',
        }),
      }}
      {...other}
    >
      {children}
    </Box>
  );
});

TabPanel.displayName = 'TabPanel';

// Main Tabs component
export const Tabs: React.FC<TabsProps> = React.memo(({
  items,
  defaultTab = 0,
  onChange,
  ariaLabel = 'Navigation tabs',
  centered = false,
  vertical = false,
  className,
  scrollable = false,
  lazyLoad = true,
  transitionProps = {
    timeout: 300,
    easing: 'ease',
  },
  variant = 'standard',
}) => {
  const [value, setValue] = useState(defaultTab);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [isScrollVisible, setIsScrollVisible] = useState(false);

  // Handle tab change with accessibility considerations
  const handleChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
    onChange?.(newValue);

    // Ensure proper focus management
    const tabElement = event.currentTarget as HTMLElement;
    tabElement.focus();

    // Scroll into view for scrollable tabs
    if (scrollable && tabsRef.current) {
      const tabRect = tabElement.getBoundingClientRect();
      const containerRect = tabsRef.current.getBoundingClientRect();
      
      if (tabRect.right > containerRect.right || tabRect.left < containerRect.left) {
        tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [onChange, scrollable]);

  // Monitor scroll visibility
  useEffect(() => {
    if (scrollable && tabsRef.current) {
      const observer = new ResizeObserver(() => {
        if (tabsRef.current) {
          setIsScrollVisible(
            tabsRef.current.scrollWidth > tabsRef.current.clientWidth
          );
        }
      });

      observer.observe(tabsRef.current);
      return () => observer.disconnect();
    }
  }, [scrollable]);

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: vertical ? 'row' : 'column',
        ...lightTheme.typography.body1,
      }}
      className={className}
    >
      <MuiTabs
        ref={tabsRef}
        value={value}
        onChange={handleChange}
        aria-label={ariaLabel}
        centered={!vertical && centered}
        orientation={vertical ? 'vertical' : 'horizontal'}
        variant={variant}
        scrollButtons={scrollable ? 'auto' : false}
        allowScrollButtonsMobile={scrollable}
        sx={{
          borderRight: vertical ? 1 : 0,
          borderColor: 'divider',
          minHeight: vertical ? '300px' : undefined,
          '& .MuiTab-root': {
            minHeight: '48px',
            padding: lightTheme.spacing(1.5, 2),
            textTransform: 'none',
            fontWeight: lightTheme.typography.fontWeightMedium,
            color: lightTheme.palette.text.secondary,
            '&.Mui-selected': {
              color: lightTheme.palette.primary.main,
            },
            '&.Mui-disabled': {
              opacity: 0.5,
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: lightTheme.palette.primary.main,
          },
        }}
      >
        {items.map((item, index) => (
          <Tab
            key={item.id}
            label={item.label}
            disabled={item.disabled}
            icon={item.icon}
            aria-label={item.ariaLabel}
            title={item.tooltip}
            {...a11yProps(index, vertical, item.id)}
          />
        ))}
      </MuiTabs>

      <Box
        sx={{
          flexGrow: 1,
          position: 'relative',
          overflow: 'hidden',
          transition: `opacity ${transitionProps.timeout}ms ${transitionProps.easing}`,
        }}
      >
        {items.map((item, index) => (
          <TabPanel
            key={item.id}
            value={value}
            index={index}
            lazyLoad={lazyLoad}
          >
            {item.content}
          </TabPanel>
        ))}
      </Box>
    </Box>
  );
});

Tabs.displayName = 'Tabs';

export default Tabs;