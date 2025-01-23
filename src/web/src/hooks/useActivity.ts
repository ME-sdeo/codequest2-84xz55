/**
 * @fileoverview Enhanced custom React hook for managing Azure DevOps activities
 * Provides real-time activity tracking, point calculations, and tenant isolation
 * @version 1.0.0
 */

// External imports
import { useEffect, useState } from 'react'; // v18.0.0
import { useDispatch, useSelector } from 'react-redux'; // v8.0.0
import { debounce } from 'lodash'; // v4.17.21

// Internal imports
import { Activity } from '../types/activity.types';
import { ActivityService } from '../services/activity.service';
import { WebSocketService } from '../services/websocket.service';
import { 
  selectActivitiesByTenant,
  selectLoadingState,
  addRealTimeActivity,
  updateActivityPoints,
  updateAIDetection,
  fetchActivities
} from '../store/activity.slice';

// WebSocket connection status enum
enum WebSocketStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

// Hook options interface
interface UseActivityOptions {
  teamId?: string;
  userId?: string;
  tenantId: string;
  autoRefresh?: boolean;
  wsEnabled?: boolean;
}

/**
 * Enhanced custom hook for managing activities with real-time updates and tenant isolation
 * @param options Hook configuration options
 * @returns Activity management interface
 */
export const useActivity = (options: UseActivityOptions) => {
  // Destructure options with defaults
  const {
    teamId,
    userId,
    tenantId,
    autoRefresh = true,
    wsEnabled = true
  } = options;

  // Redux state management
  const dispatch = useDispatch();
  const activities = useSelector(selectActivitiesByTenant);
  const { loading, error } = useSelector(selectLoadingState);

  // Local state
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  const [activityService] = useState(() => new ActivityService(new WebSocketService({
    url: `${process.env.VITE_WS_URL}/activities`,
    compression: true
  })));

  /**
   * Fetch activities with tenant isolation
   */
  const fetchActivitiesWithContext = async () => {
    try {
      await dispatch(fetchActivities({
        page: 1,
        limit: 10,
        teamId,
        tenantId
      })).unwrap();
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  /**
   * Handle real-time activity updates
   */
  const handleActivityUpdate = (activity: Activity) => {
    if (activity.tenantId === tenantId) {
      dispatch(addRealTimeActivity(activity));
    }
  };

  /**
   * Calculate points with AI detection
   */
  const calculatePoints = (activity: Activity): number => {
    return activityService.calculatePoints(
      activity.type,
      activity.isAiGenerated,
      tenantId
    );
  };

  /**
   * Debounced point update handler
   */
  const debouncedPointUpdate = debounce((activityId: string, points: number) => {
    dispatch(updateActivityPoints({ activityId, points }));
  }, 250);

  /**
   * Handle WebSocket status changes
   */
  const handleWebSocketStatus = (status: WebSocketStatus) => {
    setWsStatus(status);
    if (status === WebSocketStatus.DISCONNECTED && autoRefresh) {
      fetchActivitiesWithContext();
    }
  };

  /**
   * Initialize WebSocket connection and subscriptions
   */
  useEffect(() => {
    if (wsEnabled) {
      setWsStatus(WebSocketStatus.CONNECTING);
      
      const wsService = activityService['wsService'];
      wsService.subscribe('activity.new', handleActivityUpdate);
      wsService.subscribe('activity.update', (activity: Activity) => {
        if (activity.tenantId === tenantId) {
          const points = calculatePoints(activity);
          debouncedPointUpdate(activity.id, points);
        }
      });

      wsService.connect(tenantId)
        .then(() => setWsStatus(WebSocketStatus.CONNECTED))
        .catch(() => setWsStatus(WebSocketStatus.ERROR));

      return () => {
        wsService.unsubscribe('activity.new', handleActivityUpdate);
        wsService.disconnect();
      };
    }
  }, [wsEnabled, tenantId]);

  /**
   * Set up auto-refresh interval
   */
  useEffect(() => {
    if (autoRefresh && !wsEnabled) {
      const refreshInterval = setInterval(fetchActivitiesWithContext, 5000);
      return () => clearInterval(refreshInterval);
    }
  }, [autoRefresh, wsEnabled, tenantId]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    fetchActivitiesWithContext();
  }, [tenantId, teamId, userId]);

  /**
   * Get activity by ID with tenant validation
   */
  const getActivityById = async (id: string): Promise<Activity | null> => {
    try {
      const activity = await activityService.fetchActivityById(id);
      if (activity && activity.tenantId === tenantId) {
        return activity;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch activity:', error);
      return null;
    }
  };

  /**
   * Update AI detection status
   */
  const updateAIDetectionStatus = (activityId: string, isAIGenerated: boolean) => {
    dispatch(updateAIDetection({ activityId, isAIGenerated }));
  };

  return {
    activities,
    loading,
    error,
    wsStatus,
    fetchActivities: fetchActivitiesWithContext,
    getActivityById,
    calculatePoints,
    updateAIDetectionStatus
  };
};

// Type exports for consumers
export type { UseActivityOptions };
export { WebSocketStatus };