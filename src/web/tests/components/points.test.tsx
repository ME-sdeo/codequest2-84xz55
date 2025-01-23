/**
 * @fileoverview Comprehensive test suite for points-related React components
 * Testing PointsCard, PointsChart, and PointsHistory components with real-time updates
 * @version 1.0.0
 */

import React from 'react'; // v18.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { vi } from 'vitest'; // v0.34.0
import { Provider } from 'react-redux'; // v8.1.0
import { axe } from '@axe-core/react'; // v4.7.0

// Components under test
import PointsCard from '../../src/components/points/PointsCard';
import PointsChart from '../../src/components/points/PointsChart';
import PointsHistory from '../../src/components/points/PointsHistory';

// Hooks and utilities
import { usePoints } from '../../src/hooks/usePoints';

// Mock the usePoints hook
vi.mock('../../src/hooks/usePoints', () => ({
  usePoints: vi.fn()
}));

// Test data
const mockPointsData = {
  totalPoints: 2450,
  currentLevel: 12,
  nextLevelThreshold: 3000,
  progressPercentage: 75,
  lastUpdateTime: new Date('2023-09-20T10:30:00Z')
};

const mockHistoryData = {
  activities: [
    {
      id: 'uuid-v4',
      activityType: 'CODE_REVIEW',
      points: 15,
      isAiGenerated: false,
      createdAt: new Date('2023-09-20T10:30:00Z'),
      details: {
        pullRequestId: 'PR-123',
        repository: 'main-repo'
      }
    }
  ],
  totalCount: 150,
  hasMore: true
};

const mockWebSocketUpdate = {
  type: 'POINTS_UPDATE',
  payload: {
    points: 25,
    activityType: 'PULL_REQUEST',
    timestamp: new Date('2023-09-20T10:32:00Z')
  }
};

describe('PointsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usePoints as jest.Mock).mockReturnValue({
      pointsHistory: [],
      levelProgress: null,
      loading: { points: false, history: false },
      error: null,
      wsStatus: { connected: true },
      getPointsHistory: vi.fn(),
      getLevelProgress: vi.fn(),
      subscribeToPointUpdates: vi.fn()
    });
  });

  it('renders loading state correctly', () => {
    (usePoints as jest.Mock).mockReturnValue({
      ...mockPointsData,
      loading: { points: true }
    });

    render(<PointsCard teamMemberId="user-123" tenantId="tenant-123" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays points and level progress', async () => {
    (usePoints as jest.Mock).mockReturnValue({
      pointsHistory: [mockHistoryData.activities[0]],
      levelProgress: {
        currentLevel: mockPointsData.currentLevel,
        progressPercentage: mockPointsData.progressPercentage
      },
      loading: { points: false }
    });

    render(<PointsCard teamMemberId="user-123" tenantId="tenant-123" />);

    await waitFor(() => {
      expect(screen.getByText('2,450')).toBeInTheDocument();
      expect(screen.getByText('Level 12')).toBeInTheDocument();
    });
  });

  it('handles real-time updates within 2 seconds', async () => {
    const mockSubscribe = vi.fn();
    (usePoints as jest.Mock).mockReturnValue({
      ...mockPointsData,
      subscribeToPointUpdates: mockSubscribe
    });

    render(<PointsCard teamMemberId="user-123" tenantId="tenant-123" />);

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('meets accessibility standards', async () => {
    const { container } = render(
      <PointsCard teamMemberId="user-123" tenantId="tenant-123" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('PointsChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chart with correct data', async () => {
    (usePoints as jest.Mock).mockReturnValue({
      pointsHistory: mockHistoryData.activities,
      loading: { history: false }
    });

    render(
      <PointsChart 
        teamMemberId="user-123" 
        timeRange="30d"
        height={300}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('handles responsive resizing', async () => {
    const { rerender } = render(
      <PointsChart 
        teamMemberId="user-123" 
        timeRange="30d"
        height={300}
      />
    );

    // Simulate resize
    global.innerWidth = 500;
    fireEvent(window, new Event('resize'));

    rerender(
      <PointsChart 
        teamMemberId="user-123" 
        timeRange="30d"
        height={300}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('region')).toHaveStyle({ height: '300px' });
    });
  });

  it('supports keyboard navigation', async () => {
    render(
      <PointsChart 
        teamMemberId="user-123" 
        timeRange="30d"
        height={300}
      />
    );

    const chart = screen.getByRole('region');
    chart.focus();
    expect(document.activeElement).toBe(chart);
  });
});

describe('PointsHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders history table with data', async () => {
    (usePoints as jest.Mock).mockReturnValue({
      pointsHistory: mockHistoryData.activities,
      loading: { history: false }
    });

    render(
      <PointsHistory 
        teamMemberId="user-123" 
        pageSize={20}
        showAiIndicator={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Code Review')).toBeInTheDocument();
    });
  });

  it('handles sorting and filtering', async () => {
    const user = userEvent.setup();
    render(
      <PointsHistory 
        teamMemberId="user-123" 
        pageSize={20}
      />
    );

    const sortButton = screen.getByRole('button', { name: /sort by date/i });
    await user.click(sortButton);

    await waitFor(() => {
      expect(sortButton).toHaveAttribute('aria-sort', 'ascending');
    });
  });

  it('displays AI detection indicators correctly', async () => {
    (usePoints as jest.Mock).mockReturnValue({
      pointsHistory: [{
        ...mockHistoryData.activities[0],
        isAiGenerated: true
      }],
      loading: { history: false }
    });

    render(
      <PointsHistory 
        teamMemberId="user-123" 
        pageSize={20}
        showAiIndicator={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('AI')).toBeInTheDocument();
    });
  });

  it('handles pagination correctly', async () => {
    const user = userEvent.setup();
    (usePoints as jest.Mock).mockReturnValue({
      pointsHistory: Array(25).fill(mockHistoryData.activities[0]),
      loading: { history: false }
    });

    render(
      <PointsHistory 
        teamMemberId="user-123" 
        pageSize={10}
      />
    );

    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    await user.click(nextPageButton);

    await waitFor(() => {
      expect(screen.getByText('11-20')).toBeInTheDocument();
    });
  });

  it('meets accessibility standards', async () => {
    const { container } = render(
      <PointsHistory 
        teamMemberId="user-123" 
        pageSize={20}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});