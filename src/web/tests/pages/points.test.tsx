/**
 * @fileoverview Comprehensive test suite for the PointsPage component
 * Testing points display, real-time updates, level progression, and accessibility
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { jest } from '@jest/globals';
import { axe } from '@axe-core/react';
import WS from 'jest-websocket-mock';
import ResizeObserver from 'resize-observer-polyfill';

// Internal imports
import PointsPage from '../../src/pages/points/PointsPage';
import { usePoints } from '../../src/hooks/usePoints';

// Mock implementations
jest.mock('../../src/hooks/usePoints');
global.ResizeObserver = ResizeObserver;

// Test data constants
const mockPointsData = {
  totalPoints: 2450,
  currentLevel: 12,
  nextLevelThreshold: 3000,
  progressPercentage: 90,
  aiGeneratedPoints: 350,
  regularPoints: 2100
};

const mockWebSocketEvent = {
  type: 'POINTS_UPDATE',
  payload: {
    points: 25,
    isAiGenerated: false,
    timestamp: '2023-01-01T00:00:00Z'
  }
};

describe('PointsPage', () => {
  let mockStore: any;
  let mockWebSocket: WS;

  beforeAll(() => {
    // Initialize WebSocket mock server
    mockWebSocket = new WS('ws://localhost:1234');
    
    // Configure mock store
    mockStore = configureStore({
      reducer: {
        points: (state = {}, action) => state
      }
    });
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock usePoints hook implementation
    (usePoints as jest.Mock).mockImplementation(() => ({
      pointsHistory: [],
      levelProgress: mockPointsData,
      loading: { points: false, history: false },
      error: null,
      wsStatus: { connected: true },
      getPointsHistory: jest.fn().mockResolvedValue([]),
      getLevelProgress: jest.fn().mockResolvedValue(mockPointsData)
    }));
  });

  afterEach(() => {
    mockWebSocket.close();
  });

  describe('Initial Rendering', () => {
    it('should render the points dashboard title', () => {
      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );
      
      expect(screen.getByText('Points Dashboard')).toBeInTheDocument();
    });

    it('should show loading skeleton when data is being fetched', () => {
      (usePoints as jest.Mock).mockImplementation(() => ({
        ...mockPointsData,
        loading: { points: true, history: true }
      }));

      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      expect(screen.getByTestId('points-loading-skeleton')).toBeInTheDocument();
    });
  });

  describe('Points Display', () => {
    it('should display total points correctly', async () => {
      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('2,450')).toBeInTheDocument();
      });
    });

    it('should show AI-generated points indicator when applicable', async () => {
      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ai-indicator')).toBeInTheDocument();
      });
    });

    it('should display level progress correctly', async () => {
      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Level 12')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
      });
    });
  });

  describe('WebSocket Integration', () => {
    it('should establish WebSocket connection on mount', async () => {
      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      await waitFor(() => {
        expect(mockWebSocket.connected).toBe(true);
      });
    });

    it('should update points in real-time when receiving WebSocket events', async () => {
      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      mockWebSocket.send(JSON.stringify(mockWebSocketEvent));

      await waitFor(() => {
        expect(screen.getByText('2,475')).toBeInTheDocument();
      });
    });

    it('should show reconnection message when WebSocket disconnects', async () => {
      (usePoints as jest.Mock).mockImplementation(() => ({
        ...mockPointsData,
        wsStatus: { connected: false }
      }));

      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      expect(screen.getByText(/Real-time updates disconnected/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when points fetch fails', async () => {
      const errorMessage = 'Failed to fetch points';
      (usePoints as jest.Mock).mockImplementation(() => ({
        ...mockPointsData,
        error: { points: errorMessage }
      }));

      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should retry fetching data on error', async () => {
      const getPointsHistory = jest.fn().mockRejectedValueOnce(new Error())
        .mockResolvedValueOnce([]);
        
      (usePoints as jest.Mock).mockImplementation(() => ({
        ...mockPointsData,
        getPointsHistory
      }));

      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      await waitFor(() => {
        expect(getPointsHistory).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('should pass accessibility checks', async () => {
      const { container } = render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      const chart = screen.getByRole('region', { name: /Points trend/i });
      fireEvent.keyDown(chart, { key: 'Tab' });
      expect(chart).toHaveFocus();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adjust layout for mobile viewport', async () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      const container = screen.getByTestId('points-container');
      expect(container).toHaveStyle({ gridTemplateColumns: '1fr' });
    });

    it('should show/hide elements based on screen size', async () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(
        <Provider store={mockStore}>
          <PointsPage teamMemberId="test-user" />
        </Provider>
      );

      const aiIndicator = screen.queryByTestId('ai-indicator');
      expect(aiIndicator).not.toBeVisible();
    });
  });
});