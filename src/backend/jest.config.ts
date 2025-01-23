import type { JestConfigWithTsJest } from 'ts-jest'; // v29.1.0

/**
 * Comprehensive Jest configuration for CodeQuest backend service
 * Implements strict testing requirements with TypeScript support
 * Enforces 80% coverage thresholds across all metrics
 */
const config: JestConfigWithTsJest = {
  // File extensions to be processed by Jest
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Root directory for test discovery
  rootDir: '.',

  // Test file pattern matching
  testRegex: '.*\\.spec\\.ts$',

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.module.ts',
    '!**/*.interface.ts',
    '!**/*.constants.ts',
    '!**/main.ts',
    '!**/test/**',
    '!**/coverage/**',
  ],

  // Coverage output directory
  coverageDirectory: '../coverage',

  // Test environment configuration
  testEnvironment: 'node',

  // Test root directories
  roots: [
    '<rootDir>/src/',
    '<rootDir>/test/',
  ],

  // Module path alias mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Test timeout configuration (30 seconds)
  testTimeout: 30000,

  // Enable verbose test output
  verbose: true,

  // Test setup files
  setupFiles: ['<rootDir>/test/setup.ts'],

  // Enable coverage collection
  collectCoverage: true,

  // Coverage report formats
  coverageReporters: [
    'text',
    'lcov',
    'json-summary',
    'html',
  ],

  // Strict coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;