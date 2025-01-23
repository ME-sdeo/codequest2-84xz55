import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Grid, Paper, Tabs, Tab, CircularProgress, Alert } from '@mui/material'; // @mui/material v5.0.0
import { styled } from '@mui/material/styles'; // @mui/material v5.0.0
import { withErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Internal imports
import TeamList from '../../components/team/TeamList';
import TeamSettings from '../../components/settings/TeamSettings';
import PointsConfiguration from '../../components/settings/PointsConfiguration';
import { useAuth } from '../../hooks/useAuth';
import useWebSocket, { ConnectionState } from '../../hooks/useWebSocket';
import type { Team } from '../../types/team.types';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: 'var(--spacing-lg)',
  margin: 'var(--spacing-md)',
  minHeight: '600px',
  position: 'relative',
  '@media (max-width: 600px)': {
    margin: 'var(--spacing-sm)',
    padding: 'var(--spacing-md)',
  }
}));

const TabPanel = styled('div')({
  padding: 'var(--spacing-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-md)',
  minHeight: '400px'
});

// Props interface
interface TeamAdminPageProps {
  organizationId: string;
  isReadOnly?: boolean;
}

// Tab panel interface
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const CustomTabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <TabPanel
    role="tabpanel"
    hidden={value !== index}
    id={`team-admin-tabpanel-${index}`}
    aria-labelledby={`team-admin-tab-${index}`}
  >
    {value === index && children}
  </TabPanel>
);

const TeamAdminPage: React.FC<TeamAdminPageProps> = ({
  organizationId,
  isReadOnly = false
}) => {
  // State management
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Custom hooks
  const { currentUser, validateRole } = useAuth();
  const { 
    isConnected: wsConnected,
    connectionState,
    subscribe,
    unsubscribe
  } = useWebSocket();

  // Role-based permissions
  const permissions = useMemo(() => ({
    canManageTeam: validateRole(['COMPANY_ADMIN', 'ORG_ADMIN']) && !isReadOnly,
    canManageMembers: validateRole(['COMPANY_ADMIN', 'ORG_ADMIN', 'DEVELOPER']) && !isReadOnly,
    canConfigurePoints: validateRole(['COMPANY_ADMIN', 'ORG_ADMIN']) && !isReadOnly
  }), [validateRole, isReadOnly]);

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (wsConnected && organizationId) {
      const handleTeamUpdate = (update: Partial<Team>) => {
        if (selectedTeam && update.id === selectedTeam.id) {
          setSelectedTeam(prev => ({ ...prev!, ...update }));
        }
      };

      subscribe(`org:${organizationId}:team:update`, handleTeamUpdate);
      return () => unsubscribe(`org:${organizationId}:team:update`, handleTeamUpdate);
    }
  }, [wsConnected, organizationId, selectedTeam, subscribe, unsubscribe]);

  // Handle team selection with validation
  const handleTeamSelect = useCallback(async (team: Team) => {
    try {
      if (!permissions.canManageTeam && !permissions.canManageMembers) {
        throw new Error('Insufficient permissions to manage team');
      }
      setSelectedTeam(team);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to select team');
    }
  }, [permissions]);

  // Handle tab change
  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  // Loading state
  if (connectionState === ConnectionState.CONNECTING) {
    return (
      <StyledPaper>
        <CircularProgress 
          size={40}
          aria-label="Loading team administration"
        />
      </StyledPaper>
    );
  }

  return (
    <StyledPaper>
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ marginBottom: 2 }}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            aria-label="Team administration tabs"
          >
            <Tab label="Teams" id="team-admin-tab-0" />
            {permissions.canManageTeam && (
              <Tab label="Settings" id="team-admin-tab-1" />
            )}
            {permissions.canConfigurePoints && (
              <Tab label="Points" id="team-admin-tab-2" />
            )}
          </Tabs>
        </Grid>

        <Grid item xs={12}>
          <CustomTabPanel value={activeTab} index={0}>
            <TeamList
              organizationId={organizationId}
              onTeamSelect={handleTeamSelect}
              className="team-list"
            />
          </CustomTabPanel>

          {permissions.canManageTeam && (
            <CustomTabPanel value={activeTab} index={1}>
              <TeamSettings
                teamId={selectedTeam?.id || ''}
                organizationId={organizationId}
                tenantId={currentUser?.companyId || ''}
                permissions={permissions}
              />
            </CustomTabPanel>
          )}

          {permissions.canConfigurePoints && (
            <CustomTabPanel value={activeTab} index={2}>
              <PointsConfiguration
                organizationId={organizationId}
                isAdmin={permissions.canConfigurePoints}
                enableAudit={true}
              />
            </CustomTabPanel>
          )}
        </Grid>
      </Grid>

      {wsConnected && (
        <div 
          className="real-time-indicator"
          aria-label="Real-time updates active"
          style={{ 
            position: 'absolute', 
            top: 16, 
            right: 16,
            color: 'green'
          }}
        >
          ●
        </div>
      )}
    </StyledPaper>
  );
};

// Export with error boundary
export default withErrorBoundary(TeamAdminPage, {
  FallbackComponent: ({ error }) => (
    <StyledPaper>
      <Alert severity="error">
        <h3>Error in Team Administration</h3>
        <pre>{error.message}</pre>
      </Alert>
    </StyledPaper>
  ),
  onError: (error) => {
    console.error('TeamAdminPage Error:', error);
  }
});