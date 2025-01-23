/**
 * @fileoverview Root React component for CodeQuest frontend application.
 * Implements application shell, routing, authentication, and global providers.
 * @version 1.0.0
 */

import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // v6.4.0
import { Provider } from 'react-redux'; // v8.1.0
import { PersistGate } from 'redux-persist/integration/react'; // v6.0.0
import { ThemeProvider, createTheme } from '@mui/material/styles'; // v5.0.0
import CssBaseline from '@mui/material/CssBaseline'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Store and persistence
import { store, persistor } from './store/store';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';

// Constants
import {
  AUTH_ROUTES,
  DASHBOARD_ROUTES,
  ADMIN_ROUTES,
  SETTINGS_ROUTES
} from './constants/routes.constants';

// Lazy-loaded components for better performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Activities = React.lazy(() => import('./pages/Activities'));
const Teams = React.lazy(() => import('./pages/Teams'));
const Leaderboard = React.lazy(() => import('./pages/Leaderboard'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const Login = React.lazy(() => import('./pages/auth/Login'));
const Register = React.lazy(() => import('./pages/auth/Register'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="error-container" role="alert">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
  </div>
);

// Loading component
const LoadingFallback: React.FC = () => (
  <div className="loading-container" role="status">
    <span>Loading...</span>
  </div>
);

/**
 * Root application component providing global providers and routing
 */
const App: React.FC = () => {
  // Initialize theme with Material Design 3 principles
  const theme = createTheme({
    palette: {
      primary: {
        main: '#1976D2',
        light: '#42A5F5',
        dark: '#1565C0'
      },
      secondary: {
        main: '#424242',
        light: '#616161',
        dark: '#212121'
      }
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '@global': {
            '@media (prefers-reduced-motion: reduce)': {
              '*': {
                animationDuration: '0.01ms !important',
                animationIterationCount: '1 !important',
                transitionDuration: '0.01ms !important',
                scrollBehavior: 'auto !important'
              }
            }
          }
        }
      }
    }
  });

  // Register service worker for PWA support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(error => {
          console.error('Service worker registration failed:', error);
        });
      });
    }
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Provider store={store}>
        <PersistGate loading={<LoadingFallback />} persistor={persistor}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Authentication Routes */}
                  <Route element={<AuthLayout variant="login" />}>
                    <Route path={AUTH_ROUTES.LOGIN} element={<Login />} />
                    <Route path={AUTH_ROUTES.REGISTER} element={<Register />} />
                  </Route>

                  {/* Dashboard Routes */}
                  <Route element={<DashboardLayout />}>
                    <Route path={DASHBOARD_ROUTES.HOME} element={<Dashboard />} />
                    <Route path={DASHBOARD_ROUTES.ACTIVITIES} element={<Activities />} />
                    <Route path={DASHBOARD_ROUTES.TEAMS} element={<Teams />} />
                    <Route path={DASHBOARD_ROUTES.LEADERBOARD} element={<Leaderboard />} />
                    <Route path={DASHBOARD_ROUTES.ANALYTICS} element={<Analytics />} />
                  </Route>

                  {/* Admin Routes */}
                  <Route element={<AdminLayout />}>
                    <Route path={ADMIN_ROUTES.COMPANY} element={<AdminDashboard />} />
                    <Route path={ADMIN_ROUTES.ORGANIZATION} element={<AdminDashboard />} />
                    <Route path={ADMIN_ROUTES.POINTS_CONFIG} element={<AdminDashboard />} />
                  </Route>

                  {/* Settings Routes */}
                  <Route path={SETTINGS_ROUTES.PROFILE} element={<DashboardLayout />} />
                  <Route path={SETTINGS_ROUTES.SECURITY} element={<DashboardLayout />} />

                  {/* Default redirect */}
                  <Route path="/" element={<Navigate to={DASHBOARD_ROUTES.HOME} replace />} />
                  <Route path="*" element={<Navigate to={DASHBOARD_ROUTES.HOME} replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
};

// Styles
const styles = {
  '.error-container': {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    padding: '2rem',
    color: '#D32F2F',
    backgroundColor: '#FFFFFF'
  },
  '.loading-container': {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#FFFFFF'
  }
} as const;

export default App;