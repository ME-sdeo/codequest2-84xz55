/**
 * @fileoverview Main leaderboard page component with real-time updates, filtering,
 * and responsive layout. Implements WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Alert
} from '@mui/material';
import debounce from 'lodash/debounce';
import { useVirtualizer } from '@tanstack/react-virtual';

// Internal imports
import LeaderboardTable from '../../components/leaderboard/LeaderboardTable';
import LeaderboardCard from '../../components/leaderboard/LeaderboardCard';
import { usePoints } from '../../hooks/usePoints';

// Styled components
const PageContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  position: 'relative',
  minHeight: 'calc(100vh - 64px)',
}));

const HeaderContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(4),
  flexWrap: 'wrap',
  gap: theme.spacing(2),
}));

const FiltersContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: theme.spacing(2),
}));

// Interfaces
interface LeaderboardPageProps {
  teamId: string;
  organizationId: string;
  isAccessible?: boolean;
  viewMode?: ViewMode;
}

interface LeaderboardFilters {
  timeRange: TimeRange;
  teamId: string;
  searchQuery: string;
  sortBy: SortOption;
}

type ViewMode = 'table' | 'card';
type TimeRange = 'day' | 'week' | 'month' | 'all';
type SortOption = 'points' | 'level' | 'recent';

// Main component
const LeaderboardPage: React.FC<LeaderboardPageProps> = React.memo(({
  teamId,
  organizationId,
  isAccessible = false,
  viewMode: initialViewMode = 'table'
}) => {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [filters, setFilters] = useState<LeaderboardFilters>({
    timeRange: 'week',
    teamId,
    searchQuery: '',
    sortBy: 'points'
  });
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const {
    leaderboard,
    loading,
    error: pointsError,
    wsStatus
  } = usePoints(teamId, {
    enableRealTime: true,
    cacheResults: true,
    retryOnFailure: true
  });

  // Virtualization setup for performance
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: leaderboard.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5
  });

  // Memoized filter handler with debouncing
  const handleFilterChange = useMemo(
    () => debounce((newFilters: Partial<LeaderboardFilters>) => {
      setFilters(prev => ({ ...prev, ...newFilters }));
    }, 300),
    []
  );

  // View mode handler
  const handleViewModeChange = useCallback((_: React.SyntheticEvent, newMode: ViewMode) => {
    setViewMode(newMode);
  }, []);

  // Error handling
  useEffect(() => {
    if (pointsError) {
      setError('Failed to load leaderboard data. Please try again.');
    }
  }, [pointsError]);

  // Cleanup
  useEffect(() => {
    return () => {
      handleFilterChange.cancel();
    };
  }, [handleFilterChange]);

  // Render loading state
  if (loading) {
    return (
      <PageContainer>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress
            aria-label="Loading leaderboard data"
            role="progressbar"
          />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <HeaderContainer>
        <Typography
          variant="h4"
          component="h1"
          aria-label="Team Leaderboard"
        >
          Team Leaderboard
        </Typography>

        <Tabs
          value={viewMode}
          onChange={handleViewModeChange}
          aria-label="Leaderboard view mode"
        >
          <Tab
            value="table"
            label="Table View"
            aria-label="Switch to table view"
          />
          <Tab
            value="card"
            label="Card View"
            aria-label="Switch to card view"
          />
        </Tabs>
      </HeaderContainer>

      <FiltersContainer>
        {/* Filter components would go here */}
      </FiltersContainer>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ marginBottom: 2 }}
        >
          {error}
        </Alert>
      )}

      {!wsStatus.connected && (
        <Alert
          severity="warning"
          sx={{ marginBottom: 2 }}
        >
          Real-time updates are currently unavailable. Retrying connection...
        </Alert>
      )}

      <Box ref={parentRef} style={{ height: 'calc(100vh - 300px)', overflow: 'auto' }}>
        {viewMode === 'table' ? (
          <LeaderboardTable
            teamId={teamId}
            loading={loading}
            showAvatar
            showAIIndicator
            virtualizedConfig={{
              height: parentRef.current?.clientHeight || 400,
              overscan: 5
            }}
            onError={(error) => setError(error.message)}
          />
        ) : (
          <Box
            role="list"
            aria-label="Leaderboard entries"
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = leaderboard[virtualRow.index];
              return (
                <LeaderboardCard
                  key={entry.teamMemberId}
                  entry={entry}
                  onClick={() => {/* Handle card click */}}
                  highlighted={entry.rank <= 3}
                  className="leaderboard-card"
                />
              );
            })}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
});

LeaderboardPage.displayName = 'LeaderboardPage';

export default LeaderboardPage;