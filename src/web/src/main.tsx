/**
 * @fileoverview Entry point for the CodeQuest React application.
 * Implements root render with providers, global styles, error boundaries,
 * performance monitoring, and real-time updates.
 * @version 1.0.0
 */

import React from 'react'; // v18.0.0
import ReactDOM from 'react-dom/client'; // v18.0.0
import { Provider } from 'react-redux'; // v8.0.0
import { PersistGate } from 'redux-persist/integration/react'; // v6.0.0
import { ThemeProvider } from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { ApplicationInsights } from '@microsoft/applicationinsights-web'; // v2.8.0

// Internal imports
import App from './App';
import { store, persistor } from './store/store';
import { lightTheme } from './config/theme.config';
import './styles/global.css';

// Initialize performance monitoring
const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.VITE_APPINSIGHTS_KEY,
    enableAutoRouteTracking: true,
    enableAjaxPerfTracking: true,
    maxAjaxCallsPerView: 500,
    enableUnhandledPromiseRejectionTracking: true
  }
});

appInsights.loadAppInsights();
appInsights.trackPageView();

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div 
    role="alert"
    className="error-boundary"
    style={{
      padding: '20px',
      margin: '20px',
      border: '1px solid #D32F2F',
      borderRadius: '4px',
      backgroundColor: '#FFEBEE'
    }}
  >
    <h2>Something went wrong</h2>
    <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
    <button
      onClick={() => window.location.reload()}
      style={{
        padding: '8px 16px',
        backgroundColor: '#1976D2',
        color: 'white',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Reload Application
    </button>
  </div>
);

// Initialize services before render
const initializeServices = async () => {
  // Register service worker for PWA support
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }

  // Track performance metrics
  if (process.env.NODE_ENV === 'production') {
    const reportWebVitals = (metric: any) => {
      appInsights.trackMetric({
        name: metric.name,
        average: metric.value,
        sampleCount: 1
      });
    };

    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(reportWebVitals);
      getFID(reportWebVitals);
      getFCP(reportWebVitals);
      getLCP(reportWebVitals);
      getTTFB(reportWebVitals);
    });
  }
};

// Root element must exist
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create React root with concurrent features
const root = ReactDOM.createRoot(rootElement);

// Initialize services and render app
initializeServices().then(() => {
  root.render(
    <React.StrictMode>
      <ErrorBoundary 
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          appInsights.trackException({ exception: error });
        }}
      >
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <ThemeProvider theme={lightTheme}>
              <App />
            </ThemeProvider>
          </PersistGate>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
});

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept();
}