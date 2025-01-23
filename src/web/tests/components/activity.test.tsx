import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';

// Components under test
import ActivityCard from '../../src/components/activity/ActivityCard';
import ActivityFeed from '../../src/components/activity/ActivityFeed';
import ActivityList from '../../src/components/activity/ActivityList';

// Types and constants
import { Activity, ActivityType } from '../../src/types/activity.types';
import { ACTIVITY_DISPLAY_CONFIG, AI_POINT_MODIFIER } from '../../src/constants/activity.constants';

// Mock data generator
const createMockActivity = (overrides = {}): Activity => ({
  id: 'test-activity-1',
  type: ActivityType.CODE_CHECKIN,
  teamMemberId: 'test-team-member-1',
  points: 10,
  isAiGenerated: false,
  metadata: {
    adoId: 'ado-123',
    repository: 'test-repo',
    url: 'https://dev.azure.com/test',
    title: 'Test Activity',
    description: 'Test activity description'
  },
  companyId: 'test-company',
  organizationId: 'test-org',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Mock WebSocket service
const mockWebSocketService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn()
};

// Custom render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui);
};

describe('ActivityCard', () => {
  const mockActivity = createMockActivity();
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders activity card with correct information', () => {
    renderWithProviders(
      <ActivityCard activity={mockActivity} onClick={mockOnClick} />
    );

    expect(screen.getByText('Code Check-in')).toBeInTheDocument();
    expect(screen.getByText('Test Activity')).toBeInTheDocument();
    expect(screen.getByText('10 points')).toBeInTheDocument();
  });

  test('applies AI point modifier for AI-generated activities', () => {
    const aiActivity = createMockActivity({ isAiGenerated: true });
    renderWithProviders(<ActivityCard activity={aiActivity} />);

    const expectedPoints = Math.round(10 * AI_POINT_MODIFIER.MULTIPLIER);
    expect(screen.getByText(`${expectedPoints} points`)).toBeInTheDocument();
    expect(screen.getByText('AI Generated')).toBeInTheDocument();
  });

  test('handles click events correctly', async () => {
    renderWithProviders(
      <ActivityCard activity={mockActivity} onClick={mockOnClick} />
    );

    await userEvent.click(screen.getByRole('article'));
    expect(mockOnClick).toHaveBeenCalledWith(mockActivity);
  });

  test('supports RTL layout', () => {
    renderWithProviders(
      <ActivityCard activity={mockActivity} dir="rtl" />
    );

    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ direction: 'rtl' });
  });

  test('meets accessibility requirements', async () => {
    const { container } = renderWithProviders(
      <ActivityCard activity={mockActivity} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ActivityFeed', () => {
  const mockActivities = [
    createMockActivity({ id: '1', createdAt: new Date('2023-01-01') }),
    createMockActivity({ id: '2', createdAt: new Date('2023-01-02') })
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('renders activity feed with real-time updates', async () => {
    const { rerender } = renderWithProviders(
      <ActivityFeed teamId="test-team" autoRefresh={true} />
    );

    // Initial loading state
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Simulate data load
    rerender(
      <ActivityFeed
        teamId="test-team"
        autoRefresh={true}
        activities={mockActivities}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });
  });

  test('handles WebSocket reconnection', async () => {
    renderWithProviders(
      <ActivityFeed teamId="test-team" autoRefresh={true} />
    );

    // Simulate WebSocket disconnection
    mockWebSocketService.disconnect();

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    // Simulate reconnection
    mockWebSocketService.connect();

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  test('updates within 2 second SLA', async () => {
    const startTime = Date.now();
    renderWithProviders(
      <ActivityFeed teamId="test-team" autoRefresh={true} />
    );

    // Simulate new activity
    const newActivity = createMockActivity({ id: '3' });
    mockWebSocketService.subscribe.mock.calls[0][1](newActivity);

    await waitFor(() => {
      expect(Date.now() - startTime).toBeLessThan(2000);
      expect(screen.getAllByRole('article')).toHaveLength(3);
    });
  });
});

describe('ActivityList', () => {
  const mockActivities = Array.from({ length: 20 }, (_, i) =>
    createMockActivity({ id: `activity-${i}` })
  );

  test('renders virtualized list for large datasets', async () => {
    renderWithProviders(
      <ActivityList
        activities={mockActivities}
        virtualizeList={true}
        pageSize={10}
      />
    );

    const virtualList = screen.getByRole('feed');
    expect(virtualList).toBeInTheDocument();
    
    // Check that only visible items are rendered
    const renderedItems = screen.getAllByRole('article');
    expect(renderedItems.length).toBeLessThan(mockActivities.length);
  });

  test('handles empty state correctly', () => {
    renderWithProviders(
      <ActivityList activities={[]} />
    );

    expect(screen.getByText('No Activities Yet')).toBeInTheDocument();
  });

  test('supports filtering by team and user', async () => {
    const teamActivities = mockActivities.map(a => ({
      ...a,
      teamId: 'test-team'
    }));

    renderWithProviders(
      <ActivityList
        activities={teamActivities}
        teamId="test-team"
        userId="test-user"
      />
    );

    await waitFor(() => {
      const items = screen.getAllByRole('article');
      items.forEach(item => {
        expect(item).toHaveAttribute('data-team-id', 'test-team');
      });
    });
  });

  test('handles loading and error states', async () => {
    const { rerender } = renderWithProviders(
      <ActivityList loading={true} />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(
      <ActivityList error="Failed to load activities" />
    );

    expect(screen.getByText('Failed to load activities')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});