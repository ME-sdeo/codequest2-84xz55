/**
 * @fileoverview Enhanced points history component with real-time updates,
 * accessibility features, and responsive design.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'; // @version 18.0.0
import { format } from 'date-fns'; // @version 2.30.0
import { Tooltip } from '@mui/material'; // @version 5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // @version 4.0.11

// Internal imports
import Table, { Column, SortConfig } from '../common/Table';
import usePoints from '../../hooks/usePoints';
import { formatPoints } from '../../utils/points.utils';
import { ActivityType } from '../../types/activity.types';
import { PointsHistory as PointsHistoryType } from '../../types/points.types';

// Component props interface
interface PointsHistoryProps {
  teamMemberId: string;
  pageSize: number;
  showAiIndicator?: boolean;
  onPointsUpdate?: (points: number) => void;
}

// Custom hook for managing points history data
const usePointsHistoryData = (teamMemberId: string, pageSize: number) => {
  const {
    getPointsHistory,
    subscribeToPointUpdates,
    loading,
    error,
    pointsHistory
  } = usePoints(teamMemberId, { enableRealTime: true });

  useEffect(() => {
    // Initial data fetch
    getPointsHistory().catch(console.error);

    // Set up real-time updates
    const unsubscribe = subscribeToPointUpdates((update) => {
      getPointsHistory().catch(console.error);
    });

    return () => {
      unsubscribe();
    };
  }, [teamMemberId, getPointsHistory, subscribeToPointUpdates]);

  return {
    data: pointsHistory,
    loading,
    error
  };
};

// Activity type display mapping
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  [ActivityType.CODE_CHECKIN]: 'Code Check-in',
  [ActivityType.PULL_REQUEST]: 'Pull Request',
  [ActivityType.CODE_REVIEW]: 'Code Review',
  [ActivityType.BUG_FIX]: 'Bug Fix',
  [ActivityType.STORY_CLOSURE]: 'Story Closure'
};

// Main component
export const PointsHistory: React.FC<PointsHistoryProps> = ({
  teamMemberId,
  pageSize,
  showAiIndicator = true,
  onPointsUpdate
}) => {
  // State management
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'createdAt',
    direction: 'desc'
  });

  // Fetch and manage points history data
  const { data, loading, error } = usePointsHistoryData(teamMemberId, pageSize);

  // Memoized table columns configuration
  const columns = useMemo<Column[]>(() => [
    {
      id: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (value: Date) => format(new Date(value), 'MMM dd, yyyy HH:mm'),
      ariaLabel: 'Sort by date',
      cellClassName: 'points-history-date'
    },
    {
      id: 'activityType',
      label: 'Activity',
      sortable: true,
      render: (value: ActivityType) => ACTIVITY_LABELS[value],
      ariaLabel: 'Sort by activity type',
      cellClassName: 'points-history-activity'
    },
    {
      id: 'points',
      label: 'Points',
      sortable: true,
      render: (value: number) => formatPoints(value, { showSign: true }),
      align: 'right',
      ariaLabel: 'Sort by points',
      cellClassName: 'points-history-points'
    },
    ...(showAiIndicator ? [{
      id: 'isAiGenerated',
      label: 'AI Generated',
      sortable: true,
      render: (value: boolean) => (
        value ? (
          <Tooltip 
            title="Points adjusted for AI-generated code"
            aria-label="AI-generated code indicator"
          >
            <span className="ai-indicator">AI</span>
          </Tooltip>
        ) : null
      ),
      align: 'center',
      hideOnMobile: true,
      cellClassName: 'points-history-ai'
    }] : [])
  ], [showAiIndicator]);

  // Handle page changes
  const handlePageChange = useCallback((newPage: number, newPageSize: number) => {
    setPage(newPage);
  }, []);

  // Handle sort changes
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortConfig({ column, direction });
  }, []);

  // Update parent component with total points when data changes
  useEffect(() => {
    if (data && onPointsUpdate) {
      const totalPoints = data.reduce((sum, item) => sum + item.points, 0);
      onPointsUpdate(totalPoints);
    }
  }, [data, onPointsUpdate]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="points-history-error" role="alert">
      <h3>Error loading points history</h3>
      <pre>{error.message}</pre>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="points-history-container">
        <Table
          columns={columns}
          data={data || []}
          total={data?.length || 0}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onSort={handleSort}
          loading={loading}
          emptyMessage="No points history available"
          ariaLabel="Points history table"
          className="points-history-table"
          testIds={{
            container: 'points-history-table',
            empty: 'points-history-empty',
            pagination: 'points-history-pagination'
          }}
          virtualScroll={data?.length > 100}
        />
      </div>
    </ErrorBoundary>
  );
};

export default PointsHistory;