import '@testing-library/jest-dom'; // v5.16.5
import { vi } from 'vitest'; // v0.34.0
import { JSDOM } from 'jsdom'; // v22.1.0
import { cleanup } from '@testing-library/react'; // v14.0.0

/**
 * Global test environment setup for CodeQuest frontend application.
 * Configures DOM environment, mocks, and testing utilities.
 */
export function setupTestEnvironment(): void {
  // Configure JSDOM environment
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  global.document = dom.window.document;
  global.window = dom.window as unknown as Window & typeof globalThis;

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock matchMedia
  global.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // Mock fetch API
  global.fetch = vi.fn();

  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  // Mock Storage APIs
  const createStorageMock = () => ({
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });

  global.localStorage = createStorageMock();
  global.sessionStorage = createStorageMock();

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Configure error handling for tests
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Add custom test utilities
  global.renderWithProviders = ({ children, initialState = {}, store = null }) => {
    // Implementation would be in a separate utility file
    console.log('Custom render utility initialized');
  };

  global.createMockStore = (initialState = {}) => {
    // Implementation would be in a separate utility file
    console.log('Mock store utility initialized');
  };
}

/**
 * Cleanup function to be run after each test
 * Ensures test isolation and prevents state leakage
 */
export function cleanupAfterEach(): void {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clean up DOM
  cleanup();
  
  // Reset storage mocks
  global.localStorage.clear();
  global.sessionStorage.clear();
  
  // Clear WebSocket mocks
  (global.WebSocket as any).mockClear();
  
  // Clear any pending timers
  vi.clearAllTimers();
  
  // Reset any custom matchers or utilities
  vi.resetModules();
}

// Configure automatic cleanup after each test
afterEach(() => {
  cleanupAfterEach();
});

// Export default setup function
export default setupTestEnvironment;