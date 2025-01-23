import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';

import ActivityPage from '../../src/pages/activities/ActivityPage';
import { useActivity, WebSocketStatus } from '../../src/hooks/useActivity';
import { lightTheme } from '../../src/config/theme.config';
import { createTestStore } from '../utils/test-store';
import { Activity, ActivityType } from '../../src/types/activity.types';

// Mock hooks and services
vi.mock('../../src/hooks/useActivity');
vi.mock('ws');

// Test utilities
const createTestActivity = (overrides = {}): Activity => ({
  id: 'test-activity-1',
  type: ActivityType.CODE_CHECKIN,
  teamMemberId: 'test-team-member',
  points: 10,
  isAiGenerated: false,
  metadata: {
    adoId: 'ado-123',
    repository: 'test-repo',
    url: 'https://dev.azure.com/test',
    title: 'Test Activity',
    description: 'Test activity description'
  },
  tenantId: 'test-tenant',
  companyId: 'test-company',
  organizationId: 'test-org',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const renderWithProviders = (ui: React.ReactNode, options = {}) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider theme={lightTheme}>
          {ui}
        </ThemeProvider>
      </BrowserRouter>
    </Provider>,
    options
  );
};

describe('ActivityPage', () => {
  const mockActivities = [
    createTestActivity(),
    createTestActivity({
      id: 'test-activity-2',
      type: ActivityType.PULL_REQUEST,
      isAiGenerated: true,
      points: 18.75 // 25 * 0.75 for AI-generated
    })
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useActivity as jest.Mock).mockReturnValue({
      activities: mockActivities,
      loading: false,
      error: null,
      wsStatus: WebSocketStatus.CONNECTED,
      fetchActivities: vi.fn(),
      updateAIDetectionStatus: vi.fn()
    });
  });

  it('should render activity feed with correct activities', async () => {
    renderWithProviders(<ActivityPage />);

    // Verify activities are rendered
    const activities = screen.getAllByRole('article');
    expect(activities).toHaveLength(2);

    // Verify first activity details
    const firstActivity = within(activities[0]);
    expect(firstActivity.getByText('Test Activity')).toBeInTheDocument();
    expect(firstActivity.getByText('10 points')).toBeInTheDocument();

    // Verify AI-generated activity
    const secondActivity = within(activities[1]);
    expect(secondActivity.getByText('18.75 points')).toBeInTheDocument();
    expect(secondActivity.getByText('AI Generated')).toBeInTheDocument();
  });

  it('should handle real-time updates within 2 seconds', async () => {
    const mockUpdateActivity = createTestActivity({
      id: 'test-activity-3',
      points: 15
    });

    const { rerender } = renderWithProviders(<ActivityPage />);

    // Simulate WebSocket update
    (useActivity as jest.Mock).mockReturnValue({
      activities: [...mockActivities, mockUpdateActivity],
      loading: false,
      error: null,
      wsStatus: WebSocketStatus.CONNECTED
    });

    rerender(<ActivityPage />);

    // Verify update appears within 2 seconds
    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(3);
    }, { timeout: 2000 });

    // Verify new activity is rendered correctly
    const newActivity = screen.getByText('15 points');
    expect(newActivity).toBeInTheDocument();
  });

  it('should display correct connection status', () => {
    renderWithProviders(<ActivityPage />);

    const statusIndicator = screen.getByRole('status');
    expect(statusIndicator).toHaveTextContent('Live Updates Active');
    expect(statusIndicator).toHaveClass('connected');
  });

  it('should handle loading state correctly', () => {
    (useActivity as jest.Mock).mockReturnValue({
      activities: [],
      loading: true,
      error: null,
      wsStatus: WebSocketStatus.CONNECTING
    });

    renderWithProviders(<ActivityPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should handle error state with retry functionality', async () => {
    const mockFetchActivities = vi.fn();
    (useActivity as jest.Mock).mockReturnValue({
      activities: [],
      loading: false,
      error: 'Failed to load activities',
      wsStatus: WebSocketStatus.ERROR,
      fetchActivities: mockFetchActivities
    });

    renderWithProviders(<ActivityPage />);

    expect(screen.getByText('Failed to load activities')).toBeInTheDocument();
    
    // Test retry functionality
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);
    expect(mockFetchActivities).toHaveBeenCalled();
  });

  it('should be accessible', async () => {
    const { container } = renderWithProviders(<ActivityPage />);
    
    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA labels and roles
    expect(screen.getByRole('feed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    
    // Test keyboard navigation
    const activities = screen.getAllByRole('article');
    activities[0].focus();
    expect(activities[0]).toHaveFocus();
    
    fireEvent.keyDown(activities[0], { key: 'Tab' });
    expect(activities[1]).toHaveFocus();
  });

  it('should handle AI detection updates correctly', async () => {
    const mockUpdateAIDetection = vi.fn();
    (useActivity as jest.Mock).mockReturnValue({
      activities: mockActivities,
      loading: false,
      error: null,
      wsStatus: WebSocketStatus.CONNECTED,
      updateAIDetectionStatus: mockUpdateAIDetection
    });

    renderWithProviders(<ActivityPage />);

    // Verify AI badge is displayed correctly
    const aiActivity = screen.getAllByRole('article')[1];
    expect(within(aiActivity).getByText('AI Generated')).toBeInTheDocument();
    expect(within(aiActivity).getByText('18.75 points')).toBeInTheDocument();
  });

  it('should handle empty state correctly', () => {
    (useActivity as jest.Mock).mockReturnValue({
      activities: [],
      loading: false,
      error: null,
      wsStatus: WebSocketStatus.CONNECTED
    });

    renderWithProviders(<ActivityPage />);

    expect(screen.getByText('No activities to display')).toBeInTheDocument();
  });
});