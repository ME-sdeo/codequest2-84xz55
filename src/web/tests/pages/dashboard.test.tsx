import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe } from '@axe-core/react';
import { WebSocket, Server } from 'mock-socket';

import DashboardPage from '../../src/pages/dashboard/DashboardPage';
import { renderWithProviders, createMockStore } from '../setup';

// Mock WebSocket
const mockWebSocket = {
  url: 'ws://localhost:1234',
  connection: null as WebSocket | null,
  mockServer: null as Server | null,
};

// Mock user data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  companyId: 'test-company-id',
  teamId: 'test-team-id',
  role: 'Developer',
  preferences: {
    theme: 'light',
    notifications: true,
  },
};

// Mock activity data
const mockActivities = [
  {
    id: 'activity-1',
    type: 'CODE_REVIEW',
    points: 15,
    timestamp: new Date().toISOString(),
    isAiGenerated: false,
    metadata: {
      title: 'Code Review PR-123',
      description: 'Reviewed authentication module changes',
    },
  },
  {
    id: 'activity-2',
    type: 'PULL_REQUEST',
    points: 25,
    timestamp: new Date().toISOString(),
    isAiGenerated: true,
    metadata: {
      title: 'PR-456: Add real-time updates',
      description: 'Implemented WebSocket integration',
    },
  },
];

// Mock leaderboard data
const mockLeaderboard = [
  {
    userId: mockUser.id,
    displayName: 'Test User',
    totalPoints: 2450,
    level: 12,
    rank: 2,
  },
  {
    userId: 'user-2',
    displayName: 'Sarah M.',
    totalPoints: 3200,
    level: 15,
    rank: 1,
  },
];

describe('DashboardPage', () => {
  beforeEach(() => {
    // Setup WebSocket mock
    mockWebSocket.mockServer = new Server(mockWebSocket.url);
    global.WebSocket = WebSocket;

    // Mock hooks
    vi.mock('../../src/hooks/useAuth', () => ({
      useAuth: () => ({
        user: mockUser,
        isAuthenticated: true,
      }),
    }));

    vi.mock('../../src/hooks/useWebSocket', () => ({
      useWebSocket: () => ({
        isConnected: true,
        connectionState: 'CONNECTED',
        subscribe: vi.fn(),
      }),
    }));

    // Setup viewport size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    });
  });

  afterEach(() => {
    mockWebSocket.mockServer?.close();
    vi.clearAllMocks();
  });

  it('should render dashboard components with proper accessibility', async () => {
    const { container } = renderWithProviders(
      <DashboardPage 
        initialData={{
          activities: mockActivities,
          points: 2450,
          leaderboard: mockLeaderboard,
        }}
      />
    );

    // Check main sections are rendered
    expect(screen.getByRole('region', { name: /points summary/i })).toBeInTheDocument();
    expect(screen.getByRole('feed')).toBeInTheDocument();
    expect(screen.getByText(/team leaderboard/i)).toBeInTheDocument();

    // Verify points display
    const pointsSection = screen.getByRole('region', { name: /points summary/i });
    expect(within(pointsSection).getByText('2,450')).toBeInTheDocument();

    // Verify activities
    const activityFeed = screen.getByRole('feed');
    expect(within(activityFeed).getAllByRole('article')).toHaveLength(mockActivities.length);

    // Verify leaderboard
    const leaderboard = screen.getByRole('list');
    expect(within(leaderboard).getAllByRole('listitem')).toHaveLength(mockLeaderboard.length);

    // Run accessibility checks
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle real-time point updates', async () => {
    renderWithProviders(<DashboardPage />);

    // Simulate WebSocket point update
    mockWebSocket.mockServer?.emit('points:update', {
      userId: mockUser.id,
      points: 25,
      activityType: 'PULL_REQUEST',
      timestamp: new Date().toISOString(),
    });

    // Verify points update is reflected
    await waitFor(() => {
      const pointsDisplay = screen.getByRole('region', { name: /points summary/i });
      expect(within(pointsDisplay).getByText('2,475')).toBeInTheDocument();
    });
  });

  it('should maintain responsive layout', async () => {
    const { rerender } = renderWithProviders(<DashboardPage />);

    // Test desktop layout
    expect(screen.getByRole('region', { name: /points summary/i })).toHaveStyle({
      gridColumn: '1 / 4',
    });

    // Test tablet layout
    window.innerWidth = 768;
    window.dispatchEvent(new Event('resize'));
    rerender(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /points summary/i })).toHaveStyle({
        gridColumn: '1 / -1',
      });
    });

    // Test mobile layout
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    rerender(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /points summary/i })).toHaveStyle({
        gridColumn: '1 / -1',
      });
    });
  });

  it('should handle offline state gracefully', async () => {
    vi.mock('../../src/hooks/useWebSocket', () => ({
      useWebSocket: () => ({
        isConnected: false,
        connectionState: 'DISCONNECTED',
        subscribe: vi.fn(),
      }),
    }));

    renderWithProviders(<DashboardPage />);

    // Verify offline indicator is shown
    expect(screen.getByText(/reconnecting to real-time updates/i)).toBeInTheDocument();

    // Verify data is still displayed from cache
    expect(screen.getByRole('feed')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /points summary/i })).toBeInTheDocument();
  });

  it('should handle activity clicks', async () => {
    const handleActivityClick = vi.fn();
    renderWithProviders(
      <DashboardPage 
        initialData={{ activities: mockActivities }}
        onActivityClick={handleActivityClick}
      />
    );

    // Click an activity
    const activities = screen.getAllByRole('article');
    fireEvent.click(activities[0]);

    // Verify click handler was called
    expect(handleActivityClick).toHaveBeenCalledWith(mockActivities[0]);
  });

  it('should show AI detection indicators', () => {
    renderWithProviders(
      <DashboardPage 
        initialData={{ activities: mockActivities }}
      />
    );

    // Verify AI badge is shown for AI-generated activity
    const activities = screen.getAllByRole('article');
    expect(within(activities[1]).getByText(/ai generated/i)).toBeInTheDocument();
    expect(within(activities[0]).queryByText(/ai generated/i)).not.toBeInTheDocument();
  });
});