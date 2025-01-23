/**
 * @fileoverview Route constants for the CodeQuest platform
 * Defines all application routes with type safety and role-based access control
 * @version 1.0.0
 */

// Base route paths
export const BASE_ROUTE = '/' as const;
export const AUTH_BASE = '/auth' as const;
export const DASHBOARD_BASE = '/dashboard' as const;
export const ADMIN_BASE = '/admin' as const;
export const SETTINGS_BASE = '/settings' as const;
export const API_BASE = '/api/v1' as const;

/**
 * Authentication related routes
 * Includes paths for login, registration, password management, and SSO
 */
export const AUTH_ROUTES = {
  LOGIN: `${AUTH_BASE}/login`,
  REGISTER: `${AUTH_BASE}/register`,
  FORGOT_PASSWORD: `${AUTH_BASE}/forgot-password`,
  RESET_PASSWORD: `${AUTH_BASE}/reset-password`,
  SSO: `${AUTH_BASE}/sso`,
  VERIFY_EMAIL: `${AUTH_BASE}/verify-email`
} as const;

/**
 * Main dashboard routes
 * Core feature paths accessible based on user roles
 */
export const DASHBOARD_ROUTES = {
  HOME: DASHBOARD_BASE,
  ACTIVITIES: `${DASHBOARD_BASE}/activities`,
  POINTS: `${DASHBOARD_BASE}/points`,
  TEAMS: `${DASHBOARD_BASE}/teams`,
  LEADERBOARD: `${DASHBOARD_BASE}/leaderboard`,
  ANALYTICS: `${DASHBOARD_BASE}/analytics`,
  ACHIEVEMENTS: `${DASHBOARD_BASE}/achievements`
} as const;

/**
 * Administrative routes
 * Restricted paths for company and organization management
 * Requires elevated access permissions
 */
export const ADMIN_ROUTES = {
  COMPANY: `${ADMIN_BASE}/company`,
  ORGANIZATION: `${ADMIN_BASE}/organization`,
  TEAM: `${ADMIN_BASE}/team`,
  POINTS_CONFIG: `${ADMIN_BASE}/points-config`,
  USER_MANAGEMENT: `${ADMIN_BASE}/users`,
  AUDIT_LOGS: `${ADMIN_BASE}/audit-logs`
} as const;

/**
 * Settings routes
 * User and organization configuration paths
 * Access controlled based on user role
 */
export const SETTINGS_ROUTES = {
  PROFILE: `${SETTINGS_BASE}/profile`,
  COMPANY: `${SETTINGS_BASE}/company`,
  ORGANIZATION: `${SETTINGS_BASE}/organization`,
  TEAM: `${SETTINGS_BASE}/team`,
  NOTIFICATIONS: `${SETTINGS_BASE}/notifications`,
  SECURITY: `${SETTINGS_BASE}/security`
} as const;

// Type definitions for route constants
export type AuthRoutes = typeof AUTH_ROUTES;
export type DashboardRoutes = typeof DASHBOARD_ROUTES;
export type AdminRoutes = typeof ADMIN_ROUTES;
export type SettingsRoutes = typeof SETTINGS_ROUTES;

// Union type of all possible routes
export type AppRoutes = 
  | typeof BASE_ROUTE
  | AuthRoutes[keyof AuthRoutes]
  | DashboardRoutes[keyof DashboardRoutes]
  | AdminRoutes[keyof AdminRoutes]
  | SettingsRoutes[keyof SettingsRoutes];