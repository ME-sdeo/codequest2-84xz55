/**
 * @fileoverview Core role constants, role hierarchy, and role permissions for CodeQuest's RBAC system
 * Implements comprehensive role-based access control with strict role hierarchy and granular permissions
 * @version 1.0.0
 */

/**
 * Enumeration of all available user roles in the system.
 * Used for type-safe role assignments and checks throughout the application.
 */
export enum ROLES {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  DEVELOPER = 'DEVELOPER',
  GENERAL_USER = 'GENERAL_USER'
}

/**
 * Defines the hierarchical relationships between roles.
 * Each role inherits permissions from roles in its array.
 * Higher-level roles automatically inherit permissions from lower-level roles.
 * @readonly
 */
export const ROLE_HIERARCHY: Readonly<Record<ROLES, ReadonlyArray<ROLES>>> = {
  [ROLES.SUPER_ADMIN]: [
    ROLES.COMPANY_ADMIN,
    ROLES.ORG_ADMIN,
    ROLES.DEVELOPER,
    ROLES.GENERAL_USER
  ],
  [ROLES.COMPANY_ADMIN]: [
    ROLES.ORG_ADMIN,
    ROLES.DEVELOPER,
    ROLES.GENERAL_USER
  ],
  [ROLES.ORG_ADMIN]: [
    ROLES.DEVELOPER,
    ROLES.GENERAL_USER
  ],
  [ROLES.DEVELOPER]: [
    ROLES.GENERAL_USER
  ],
  [ROLES.GENERAL_USER]: []
} as const;

/**
 * Maps each role to its specific allowed permissions and actions.
 * Permissions are granular and follow the principle of least privilege.
 * @readonly
 */
export const ROLE_PERMISSIONS: Readonly<Record<ROLES, ReadonlyArray<string>>> = {
  [ROLES.SUPER_ADMIN]: [
    'manage_companies',
    'manage_organizations',
    'manage_teams',
    'configure_global_points',
    'view_all',
    'manage_plugins',
    'manage_security',
    'manage_integrations'
  ],
  [ROLES.COMPANY_ADMIN]: [
    'manage_company_organizations',
    'manage_company_teams',
    'configure_company_points',
    'view_company_data',
    'manage_company_users',
    'configure_company_plugins'
  ],
  [ROLES.ORG_ADMIN]: [
    'manage_org_teams',
    'configure_org_points',
    'view_org_data',
    'manage_org_users',
    'configure_org_settings'
  ],
  [ROLES.DEVELOPER]: [
    'view_team_data',
    'earn_points',
    'view_personal_stats',
    'participate_activities',
    'submit_code'
  ],
  [ROLES.GENERAL_USER]: [
    'view_public_data',
    'view_leaderboard',
    'view_achievements'
  ]
} as const;

/**
 * Type guard to check if a string is a valid role
 * @param role - String to check if it's a valid role
 * @returns Boolean indicating if the string is a valid role
 */
export const isValidRole = (role: string): role is ROLES => {
  return Object.values(ROLES).includes(role as ROLES);
};

/**
 * Type guard to check if a string is a valid permission
 * @param permission - String to check if it's a valid permission
 * @returns Boolean indicating if the string is a valid permission
 */
export const isValidPermission = (permission: string): boolean => {
  return Object.values(ROLE_PERMISSIONS)
    .flat()
    .includes(permission);
};

/**
 * Gets all permissions for a role including inherited permissions from role hierarchy
 * @param role - Role to get permissions for
 * @returns Array of all permissions for the role including inherited permissions
 */
export const getAllPermissionsForRole = (role: ROLES): ReadonlyArray<string> => {
  const inheritedRoles = [role, ...ROLE_HIERARCHY[role]];
  return [...new Set(
    inheritedRoles.flatMap(r => ROLE_PERMISSIONS[r])
  )] as ReadonlyArray<string>;
};