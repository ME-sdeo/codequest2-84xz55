import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0+
import userEvent from '@testing-library/user-event'; // v14.0+
import { axe, toHaveNoViolations } from 'jest-axe'; // v7.0+
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.0+

// Component imports
import TeamCard from '../../src/components/team/TeamCard';
import TeamList from '../../src/components/team/TeamList';
import TeamMembers from '../../src/components/team/TeamMembers';
import type { Team, TeamMember } from '../../src/types/team.types';

// Mock data
const mockTeam: Team = {
  id: '123',
  name: 'Frontend Team',
  totalPoints: 2450,
  memberCount: 5,
  members: [],
  isActive: true,
  lastActivityAt: new Date(),
  version: '1',
  metadata: {},
  companyId: 'company-123',
  organizationId: 'org-123',
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockTeamMember: TeamMember = {
  id: 'member-123',
  teamId: '123',
  userId: 'user-123',
  totalPoints: 500,
  currentLevel: 5,
  achievements: [],
  joinedAt: new Date(),
  lastActivityAt: new Date(),
  pointsHistory: [],
  isActive: true
};

// Mock providers and utilities
const mockWebSocket = jest.fn();
const mockRealTimeUpdate = jest.fn();

// Custom render function with providers
const renderWithProviders = (ui: React.ReactElement, tenantConfig = { companyId: 'company-123', organizationId: 'org-123' }) => {
  return render(
    <div data-testid="test-container" data-tenant-id={tenantConfig.companyId}>
      {ui}
    </div>
  );
};

// Test setup
beforeEach(() => {
  jest.useFakeTimers();
  localStorage.setItem('tenantId', 'company-123');
  global.WebSocket = mockWebSocket as any;
});

afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  localStorage.clear();
});

// TeamCard Component Tests
describe('TeamCard', () => {
  test('renders team information correctly', () => {
    const handleClick = jest.fn();
    renderWithProviders(
      <TeamCard 
        team={mockTeam}
        onClick={handleClick}
        dataTestId="team-card"
      />
    );

    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('2,450 points')).toBeInTheDocument();
    expect(screen.getByText('5 members')).toBeInTheDocument();
  });

  test('handles click events and keyboard navigation', async () => {
    const handleClick = jest.fn();
    renderWithProviders(
      <TeamCard 
        team={mockTeam}
        onClick={handleClick}
        dataTestId="team-card"
      />
    );

    const card = screen.getByTestId('team-card');
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledWith(mockTeam);

    // Test keyboard navigation
    fireEvent.keyPress(card, { key: 'Enter', code: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  test('meets accessibility requirements', async () => {
    const { container } = renderWithProviders(
      <TeamCard 
        team={mockTeam}
        onClick={() => {}}
        dataTestId="team-card"
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('updates points in real-time within SLA', async () => {
    const updatedTeam = { ...mockTeam, totalPoints: 2500 };
    renderWithProviders(
      <TeamCard 
        team={mockTeam}
        onClick={() => {}}
        dataTestId="team-card"
      />
    );

    mockRealTimeUpdate(updatedTeam, 1000);
    await waitFor(() => {
      expect(screen.getByText('2,500 points')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

// TeamList Component Tests
describe('TeamList', () => {
  const mockTeams = [mockTeam];

  test('renders team list with virtualization', async () => {
    renderWithProviders(
      <TeamList
        organizationId="org-123"
        onTeamSelect={() => {}}
        sortBy="totalPoints"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });
  });

  test('handles team filtering and sorting', async () => {
    renderWithProviders(
      <TeamList
        organizationId="org-123"
        onTeamSelect={() => {}}
        sortBy="totalPoints"
        filterBy={{ minPoints: 2000 }}
      />
    );

    await waitFor(() => {
      const teamCards = screen.getAllByTestId(/^team-card/);
      expect(teamCards.length).toBeGreaterThan(0);
    });
  });

  test('maintains tenant isolation', async () => {
    renderWithProviders(
      <TeamList
        organizationId="org-123"
        onTeamSelect={() => {}}
      />,
      { companyId: 'wrong-company', organizationId: 'wrong-org' }
    );

    await waitFor(() => {
      expect(screen.queryByTestId('team-card-123')).not.toBeInTheDocument();
    });
  });

  test('handles error states gracefully', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(
      <TeamList
        organizationId="invalid-org"
        onTeamSelect={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

// TeamMembers Component Tests
describe('TeamMembers', () => {
  const mockMembers = [mockTeamMember];

  test('renders member list with correct data', async () => {
    renderWithProviders(
      <TeamMembers
        teamId="123"
        isAdmin={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  test('handles admin actions when authorized', async () => {
    const handleUpdate = jest.fn();
    renderWithProviders(
      <TeamMembers
        teamId="123"
        isAdmin={true}
        onMemberUpdate={handleUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Add new member')).toBeInTheDocument();
    });

    // Test member removal
    const removeButton = screen.getByLabelText('Remove member');
    fireEvent.click(removeButton);
    
    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalled();
    });
  });

  test('updates member data in real-time', async () => {
    const updatedMember = { ...mockTeamMember, totalPoints: 550 };
    renderWithProviders(
      <TeamMembers
        teamId="123"
        isAdmin={false}
      />
    );

    mockRealTimeUpdate({ members: [updatedMember] }, 1000);
    
    await waitFor(() => {
      expect(screen.getByText('550')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  test('maintains data integrity during optimistic updates', async () => {
    renderWithProviders(
      <TeamMembers
        teamId="123"
        isAdmin={true}
      />
    );

    // Simulate optimistic update
    const editButton = await screen.findByLabelText('Edit member');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(mockTeamMember.totalPoints.toString())).toBeInTheDocument();
    });
  });
});