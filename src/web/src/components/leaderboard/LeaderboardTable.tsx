/**
 * @fileoverview High-performance, accessible leaderboard table component with real-time updates
 * and AI activity detection support. Implements WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'; // v18.0+
import { styled } from '@mui/material/styles'; // v5.0+
import { useTranslation } from 'react-i18next'; // v12.0+
import { ErrorBoundary } from 'react-error-boundary'; // v4.0+

// Internal imports
import Table from '../common/Table';
import Avatar from '../common/Avatar';
import { usePoints } from '../../hooks/usePoints';
import { formatPoints } from '../../utils/points.utils';
import type { LeaderboardEntry } from '../../types/points.types';

// Styled components for enhanced visual hierarchy and accessibility
const StyledRankCell = styled('div')(({ theme }) => ({
  width: '60px',
  fontWeight: 'bold',
  color: theme.palette.text.primary,
  textAlign: 'center',
  padding: theme.spacing(1),
  '&[data-top-three="true"]': {
    color: theme.palette.primary.main,
    fontSize: '1.1em'
  }
}));

const StyledNameCell = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  minWidth: '200px',
  padding: theme.spacing(1)
}));

const StyledPointsCell = styled('div')(({ theme }) => ({
  fontWeight: 500,
  color: theme.palette.primary.main,
  textAlign: 'right',
  fontFeatureSettings: '"tnum"',
  padding: theme.spacing(1)
}));

const StyledAIIndicator = styled('div')(({ theme }) => ({
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  backgroundColor: theme.palette.warning.light,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'help'
}));

// Props interface with comprehensive configuration options
interface LeaderboardTableProps {
  teamId: string;
  pageSize?: number;
  showAvatar?: boolean;
  loading?: boolean;
  showAIIndicator?: boolean;
  locale?: string;
  virtualizedConfig?: {
    height: number;
    overscan: number;
  };
  onError?: (error: Error) => void;
}

// Main component implementation
const LeaderboardTable = memo(({
  teamId,
  pageSize = 20,
  showAvatar = true,
  loading = false,
  showAIIndicator = true,
  locale = 'en-US',
  virtualizedConfig,
  onError
}: LeaderboardTableProps) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const { getTeamLeaderboard, useWebSocketUpdates } = usePoints();

  // Initialize real-time updates
  useEffect(() => {
    const subscription = useWebSocketUpdates(teamId, (update) => {
      setEntries(prevEntries => {
        const updatedEntries = [...prevEntries];
        const index = updatedEntries.findIndex(e => e.teamMemberId === update.teamMemberId);
        if (index !== -1) {
          updatedEntries[index] = { ...updatedEntries[index], ...update };
        }
        return updatedEntries.sort((a, b) => b.totalPoints - a.totalPoints);
      });
    });

    return () => subscription.unsubscribe();
  }, [teamId, useWebSocketUpdates]);

  // Initial data fetch
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await getTeamLeaderboard(teamId);
        setEntries(data);
      } catch (error) {
        onError?.(error as Error);
      }
    };
    fetchLeaderboard();
  }, [teamId, getTeamLeaderboard, onError]);

  // Memoized column configuration
  const columns = useMemo(() => [
    {
      id: 'rank',
      label: t('leaderboard.rank'),
      align: 'center' as const,
      render: (_: any, index: number) => (
        <StyledRankCell data-top-three={index < 3}>
          {index + 1}
        </StyledRankCell>
      ),
      ariaLabel: t('leaderboard.rank.aria')
    },
    {
      id: 'user',
      label: t('leaderboard.user'),
      render: (entry: LeaderboardEntry) => (
        <StyledNameCell>
          {showAvatar && (
            <Avatar
              name={entry.displayName}
              size="small"
              ariaLabel={t('leaderboard.avatar.aria', { name: entry.displayName })}
            />
          )}
          <span>{entry.displayName}</span>
          {showAIIndicator && entry.recentActivities.some(a => a.isAiGenerated) && (
            <StyledAIIndicator
              role="img"
              aria-label={t('leaderboard.ai.indicator.aria')}
              title={t('leaderboard.ai.indicator.tooltip')}
            >
              AI
            </StyledAIIndicator>
          )}
        </StyledNameCell>
      )
    },
    {
      id: 'points',
      label: t('leaderboard.points'),
      align: 'right' as const,
      render: (entry: LeaderboardEntry) => (
        <StyledPointsCell>
          {formatPoints(entry.totalPoints, { locale, useKSuffix: true })}
        </StyledPointsCell>
      ),
      ariaLabel: t('leaderboard.points.aria')
    },
    {
      id: 'level',
      label: t('leaderboard.level'),
      align: 'center' as const,
      render: (entry: LeaderboardEntry) => (
        <div>{t('leaderboard.level.value', { level: entry.level })}</div>
      ),
      ariaLabel: t('leaderboard.level.aria')
    }
  ], [t, showAvatar, showAIIndicator, locale]);

  // Error fallback component
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }: any) => (
    <div role="alert">
      <p>{t('leaderboard.error.message')}</p>
      <button onClick={resetErrorBoundary}>
        {t('leaderboard.error.retry')}
      </button>
    </div>
  ), [t]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => setEntries([])}
      onError={onError}
    >
      <Table
        columns={columns}
        data={entries}
        loading={loading}
        pageSize={pageSize}
        virtualScroll={!!virtualizedConfig}
        virtualizedConfig={virtualizedConfig}
        ariaLabel={t('leaderboard.table.aria')}
        emptyMessage={t('leaderboard.empty')}
        testIds={{
          container: 'leaderboard-table',
          empty: 'leaderboard-empty',
          loading: 'leaderboard-loading'
        }}
      />
    </ErrorBoundary>
  );
});

LeaderboardTable.displayName = 'LeaderboardTable';

export default LeaderboardTable;