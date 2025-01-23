/**
 * @fileoverview Vite configuration for CodeQuest frontend application
 * Defines build settings, development server options, plugins, and optimizations
 * @version 1.0.0
 */

// External imports
import { defineConfig } from 'vite'; // v4.4.0
import react from '@vitejs/plugin-react'; // v4.0.0
import path from 'path';

// Internal imports
import { apiConfig } from './src/config/api.config';

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for rapid development
      fastRefresh: true,
      // Use automatic JSX runtime for optimal performance
      jsxRuntime: 'automatic',
      // Configure Babel plugins for emotion styling
      babel: {
        plugins: ['@emotion/babel-plugin']
      }
    })
  ],

  // Path resolution and aliases for clean imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    // HTTPS configuration for secure development
    https: {
      key: './certs/localhost-key.pem',
      cert: './certs/localhost.pem'
    },
    // API proxy configuration with WebSocket support
    proxy: {
      '/api': {
        target: apiConfig.baseURL,
        changeOrigin: true,
        secure: false,
        ws: true,
        headers: {
          'Connection': 'keep-alive'
        }
      }
    },
    // Hot Module Replacement settings
    hmr: {
      overlay: true,
      clientPort: 3000
    }
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    // Advanced chunk splitting for optimal loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // UI framework chunks
          mui: ['@mui/material', '@mui/icons-material'],
          // State management chunks
          redux: ['@reduxjs/toolkit', 'react-redux'],
          // Utility chunks
          utils: ['lodash', 'date-fns', 'uuid']
        }
      }
    },
    // Production optimization settings
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },

  // Test environment configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}'
      ],
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    testMatch: ['**/*.{test,spec}.{ts,tsx}']
  },

  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@reduxjs/toolkit'
    ],
    exclude: ['@testing-library/react']
  },

  // Error handling and logging
  clearScreen: false,
  logLevel: 'info',
  envPrefix: 'VITE_'
});