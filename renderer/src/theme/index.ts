/**
 * MUI Theme Configuration
 * 
 * Centralized theme for the entire application using Material UI.
 * Provides consistent colors, typography, and component styling.
 */
import { createTheme, type ThemeOptions } from '@mui/material/styles';

// Font family stack for consistency across the application
const FONT_FAMILY_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Color palette
const palette = {
  primary: {
    main: '#2563eb',
    light: '#3b82f6',
    dark: '#1d4ed8',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#6b7280',
    light: '#9ca3af',
    dark: '#4b5563',
    contrastText: '#ffffff',
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
  },
  success: {
    main: '#22c55e',
    light: '#4ade80',
    dark: '#16a34a',
  },
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
  },
  background: {
    default: '#f5f5f5',
    paper: '#ffffff',
  },
  text: {
    primary: '#333333',
    secondary: '#666666',
    disabled: '#9ca3af',
  },
  divider: '#e0e0e0',
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
};

// Custom theme options
const themeOptions: ThemeOptions = {
  palette,
  typography: {
    fontFamily: FONT_FAMILY_STACK,
    fontSize: 13,
    h1: { fontSize: '1.5rem', fontWeight: 600 },
    h2: { fontSize: '1.25rem', fontWeight: 600 },
    h3: { fontSize: '1.1rem', fontWeight: 600 },
    h4: { fontSize: '1rem', fontWeight: 600 },
    h5: { fontSize: '0.9rem', fontWeight: 600 },
    h6: { fontSize: '0.82rem', fontWeight: 600 },
    body1: { fontSize: '0.85rem' },
    body2: { fontSize: '0.78rem' },
    caption: { fontSize: '0.72rem' },
    button: { fontSize: '0.82rem', textTransform: 'none', fontWeight: 500 },
  },
  shape: {
    borderRadius: 6,
  },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
        },
        body: {
          height: '100vh',
          overflow: 'hidden',
        },
        '::-webkit-scrollbar': {
          width: '6px',
          height: '6px',
        },
        '::-webkit-scrollbar-thumb': {
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '3px',
        },
        '::-webkit-scrollbar-track': {
          background: 'transparent',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: 'none',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        sizeSmall: {
          padding: '4px 8px',
          fontSize: '0.75rem',
        },
        sizeMedium: {
          padding: '6px 12px',
          fontSize: '0.82rem',
        },
        sizeLarge: {
          padding: '8px 16px',
          fontSize: '0.9rem',
        },
      },
      defaultProps: {
        disableElevation: true,
        size: 'medium',
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          padding: 6,
        },
        sizeSmall: {
          width: 24,
          height: 24,
        },
        sizeMedium: {
          width: 28,
          height: 28,
        },
        sizeLarge: {
          width: 32,
          height: 32,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            fontSize: '0.85rem',
          },
          '& .MuiInputBase-inputSizeSmall': {
            padding: '6px 10px',
            fontSize: '0.78rem',
          },
        },
      },
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.grey[400],
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.primary.main,
            borderWidth: 1,
          },
        },
        notchedOutline: {
          borderColor: palette.grey[300],
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.1rem',
          fontWeight: 600,
          padding: '16px 20px',
          borderBottom: `1px solid ${palette.divider}`,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '20px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 20px',
          borderTop: `1px solid ${palette.divider}`,
          gap: 8,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          '&:before': {
            display: 'none',
          },
          boxShadow: 'none',
          borderRadius: 0,
          '&.Mui-expanded': {
            margin: 0,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: 40,
          padding: '0 12px',
          '&.Mui-expanded': {
            minHeight: 40,
          },
        },
        content: {
          margin: '8px 0',
          '&.Mui-expanded': {
            margin: '8px 0',
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '8px 12px 16px',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 36,
        },
        indicator: {
          height: 2,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 36,
          padding: '6px 12px',
          fontSize: '0.82rem',
          fontWeight: 500,
          textTransform: 'none',
          '&.Mui-selected': {
            fontWeight: 600,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: `1px solid ${palette.divider}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          height: 24,
          fontSize: '0.75rem',
        },
        sizeSmall: {
          height: 20,
          fontSize: '0.72rem',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.72rem',
          padding: '4px 8px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          padding: '6px 10px',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
            },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '6px 12px',
        },
        standardError: {
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          color: '#dc2626',
        },
        standardSuccess: {
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          color: '#16a34a',
        },
        standardWarning: {
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          color: '#d97706',
        },
        standardInfo: {
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          color: '#2563eb',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
          border: `1px solid ${palette.divider}`,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.82rem',
          padding: '8px 12px',
          borderRadius: 4,
          margin: '2px 4px',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(0, 0, 0, 0.06)',
            fontWeight: 600,
          },
        },
      },
    },
  },
};

// Create and export the theme
export const theme = createTheme(themeOptions);

// Export palette for use in sx props
export { palette };
