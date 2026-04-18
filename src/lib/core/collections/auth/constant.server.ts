export const PRIVATE_FIELDS = ['password', 'token', 'isSuperAdmin', 'apiKeyId', 'authUserId'];

export const BETTER_AUTH_ROLES = {
  /** Panel users admin */
  ADMIN: 'admin',
  /** Panel users any role */
  STAFF: 'staff',
  /** All other users */
  USER: 'user'
} as const;
