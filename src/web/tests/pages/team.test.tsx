import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { vi } from 'vitest'; // v0.34.0
import { MemoryRouter } from 'react-router-dom'; // v6.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // v4.7.3

import TeamsPage from '../../src/pages/teams/TeamsPage';
import { useTeam } from '../../src/hooks/useTeam';

// Mock dependencies
vi.mock('../../src/hooks/useTeam');
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => vi.fn(),
}));

// Mock ResizeObserver for responsive tests
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Test data
const mockTeams = [
  {
    id: '1',
    name: 'Frontend Team',
    totalPoints: 2500,
    memberCount: 5,
    isActive: true,
    lastActivityAt: new Date(),
    version: '1',
    metadata: {},
  },
  {
    id: '2',
    name: 'Backend Team',
    totalPoints: 3000,
    memberCount: 4,
    isActive: true,
    lastActivityAt: new Date(),
    version: '1',
    metadata: {},
  },
];

// Test setup helper
const setupTest = (props = {}) => {
  const mockUseTeam = {
    teams: mockTeams,
    loading: false,
    error: null,
    createTeam: vi.fn(),
    fetchTeams: vi.fn(),
    subscription: { unsubscribe: vi.fn() },
  };

  (useTeam as jest.Mock).mockReturnValue(mockUseTeam);

  return render(
    <MemoryRouter>
      <TeamsPage organizationId="org-123" {...props} />
    </MemoryRouter>
  );
};

describe('TeamsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the teams page with correct title and create button', () => {
      setupTest();

      expect(screen.getByRole('heading', { name: /teams/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
    });

    it('displays loading state correctly', () => {
      (useTeam as jest.Mock).mockReturnValue({
        teams: [],
        loading: true,
        error: null,
      });

      setupTest();

      expect(screen.getByLabelText(/loading teams/i)).toBeInTheDocument();
    });

    it('displays error state correctly', () => {
      const errorMessage = 'Failed to load teams';
      (useTeam as jest.Mock).mockReturnValue({
        teams: [],
        loading: false,
        error: new Error(errorMessage),
      });

      setupTest();

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('renders team list when data is available', () => {
      setupTest();

      mockTeams.forEach(team => {
        expect(screen.getByText(team.name)).toBeInTheDocument();
        expect(screen.getByText(`${team.memberCount} members`)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('handles real-time team updates within 2 seconds', async () => {
      const { rerender } = setupTest();

      const updatedTeams = [
        ...mockTeams,
        {
          id: '3',
          name: 'New Team',
          totalPoints: 1000,
          memberCount: 2,
          isActive: true,
          lastActivityAt: new Date(),
          version: '1',
          metadata: {},
        },
      ];

      (useTeam as jest.Mock).mockReturnValue({
        teams: updatedTeams,
        loading: false,
        error: null,
      });

      rerender(
        <MemoryRouter>
          <TeamsPage organizationId="org-123" />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('New Team')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('cleans up subscription on unmount', () => {
      const unsubscribe = vi.fn();
      (useTeam as jest.Mock).mockReturnValue({
        teams: mockTeams,
        loading: false,
        error: null,
        subscription: { unsubscribe },
      });

      const { unmount } = setupTest();
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    it('handles team creation with correct navigation', async () => {
      const mockNavigate = vi.fn();
      vi.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);

      const mockCreateTeam = vi.fn().mockResolvedValue({ id: 'new-team-id' });
      (useTeam as jest.Mock).mockReturnValue({
        teams: mockTeams,
        loading: false,
        error: null,
        createTeam: mockCreateTeam,
      });

      setupTest();

      await userEvent.click(screen.getByRole('button', { name: /create team/i }));

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith({
          name: 'New Team',
          organizationId: 'org-123',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/teams/new-team-id/edit');
      });
    });

    it('handles team selection with correct navigation', async () => {
      const mockNavigate = vi.fn();
      vi.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);

      setupTest();

      await userEvent.click(screen.getByText(mockTeams[0].name));

      expect(mockNavigate).toHaveBeenCalledWith(`/teams/${mockTeams[0].id}`);
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 AA standards', async () => {
      const { container } = setupTest();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      setupTest();

      const createButton = screen.getByRole('button', { name: /create team/i });
      const teamCards = screen.getAllByRole('button', { name: /team/i });

      // Tab to create button
      await userEvent.tab();
      expect(createButton).toHaveFocus();

      // Tab to first team card
      await userEvent.tab();
      expect(teamCards[0]).toHaveFocus();

      // Test Enter key interaction
      await userEvent.keyboard('{Enter}');
      expect(screen.getByTestId(`team-card-${mockTeams[0].id}`)).toBeInTheDocument();
    });

    it('provides proper ARIA labels and roles', () => {
      setupTest();

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Teams Page');
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Teams list');
    });
  });

  describe('Performance', () => {
    it('renders within performance budget', async () => {
      const startTime = performance.now();
      setupTest();
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(500); // 500ms SLA requirement
    });

    it('handles large team lists efficiently', async () => {
      const largeTeamList = Array.from({ length: 100 }, (_, i) => ({
        ...mockTeams[0],
        id: `team-${i}`,
        name: `Team ${i}`,
      }));

      (useTeam as jest.Mock).mockReturnValue({
        teams: largeTeamList,
        loading: false,
        error: null,
      });

      const startTime = performance.now();
      setupTest();
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(500); // Should still meet SLA with large dataset
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile viewport', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      setupTest();

      const header = screen.getByRole('heading', { name: /teams/i }).parentElement;
      expect(header).toHaveStyle({ flexDirection: 'column' });
    });

    it('adapts layout for tablet viewport', () => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));

      setupTest();

      const teamGrid = screen.getByRole('grid');
      expect(teamGrid).toHaveStyle({ gridTemplateColumns: 'repeat(2, 1fr)' });
    });

    it('adapts layout for desktop viewport', () => {
      global.innerWidth = 1240;
      global.dispatchEvent(new Event('resize'));

      setupTest();

      const teamGrid = screen.getByRole('grid');
      expect(teamGrid).toHaveStyle({ gridTemplateColumns: 'repeat(4, 1fr)' });
    });
  });
});