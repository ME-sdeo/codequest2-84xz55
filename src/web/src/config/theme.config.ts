import { createTheme, ThemeOptions, PaletteMode } from '@mui/material'; // @mui/material v5.0+

// Extended theme options interface with custom properties
interface CustomThemeOptions extends ThemeOptions {
  palette: ThemeOptions['palette'] & {
    mode: PaletteMode;
    contrast: {
      high: boolean;
    };
  };
  typography: ThemeOptions['typography'] & {
    fontFamilyMono: string;
    responsiveScale: number;
  };
  spacing: ThemeOptions['spacing'] & {
    customSpacing: (factor: number) => number;
  };
  breakpoints: ThemeOptions['breakpoints'] & {
    containerWidth: {
      sm: number;
      md: number;
      lg: number;
    };
  };
  accessibility: {
    contrast: 'normal' | 'high';
    animations: 'enabled' | 'reduced';
  };
}

// Base theme configuration
const THEME_CONFIG: Partial<CustomThemeOptions> = {
  palette: {
    primary: {
      main: '#1976D2',
      light: '#42A5F5',
      dark: '#1565C0',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#424242',
      light: '#616161',
      dark: '#212121',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#D32F2F',
      light: '#EF5350',
      dark: '#C62828',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFFFFF',
      paper: '#F5F5F5',
      dark: '#121212',
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontFamilySecondary: 'SF Pro, system-ui, sans-serif',
    fontFamilyMono: 'JetBrains Mono, monospace',
    responsiveScale: 1.2,
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1240,
      xl: 1920,
    },
    containerWidth: {
      sm: 540,
      md: 720,
      lg: 1170,
    },
  },
};

// Theme creation function with mode and accessibility support
const createAppTheme = (
  mode: PaletteMode,
  options: Partial<CustomThemeOptions> = {}
) => {
  const baseTheme = {
    ...THEME_CONFIG,
    palette: {
      ...THEME_CONFIG.palette,
      mode,
      // Mode-specific palette adjustments
      background: {
        ...THEME_CONFIG.palette?.background,
        default: mode === 'light' ? '#FFFFFF' : '#121212',
        paper: mode === 'light' ? '#F5F5F5' : '#1E1E1E',
      },
    },
    // Custom spacing function
    spacing: (factor: number) => `${8 * factor}px`,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '@global': {
            '@media (prefers-reduced-motion: reduce)': {
              '*': {
                animationDuration: '0.01ms !important',
                animationIterationCount: '1 !important',
                transitionDuration: '0.01ms !important',
                scrollBehavior: 'auto !important',
              },
            },
          },
        },
      },
      // Ensure sufficient color contrast for accessibility
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: '44px', // WCAG 2.1 AA touch target size
          },
        },
      },
    },
  };

  // Create the theme with custom extensions
  const theme = createTheme({
    ...baseTheme,
    ...options,
  });

  // Add responsive typography scaling
  theme.typography = {
    ...theme.typography,
    [theme.breakpoints.up('md')]: {
      fontSize: `${16 * (THEME_CONFIG.typography?.responsiveScale || 1)}px`,
    },
  };

  return theme;
};

// Export light and dark theme configurations
export const lightTheme = createAppTheme('light', {
  accessibility: {
    contrast: 'normal',
    animations: 'enabled',
  },
});

export const darkTheme = createAppTheme('dark', {
  accessibility: {
    contrast: 'normal',
    animations: 'enabled',
  },
});

// Export theme creation function for custom configurations
export { createAppTheme };