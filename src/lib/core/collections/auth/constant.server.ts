import type { Dic } from '$lib/util/types.js';
import type { User } from './types.js';

export const PRIVATE_FIELDS = [
  'password',
  'token',
  'isSuperAdmin',
  'apiKeyId',
  'authUserId',
  'isStaff'
];

export const BETTER_AUTH_ROLES = {
  /** Panel users admin */
  ADMIN: 'admin',
  /** Panel users any role */
  STAFF: 'staff',
  /** All other users */
  USER: 'user'
} as const;

/**
 * Strips PRIVATE_FIELDS off the session user. Call this only where a load() function is
 * about to hand `user` to the client (the public layouts in
 * dev/generate/routes/common.server.ts) — never on event.locals.user itself, which stays
 * the full object so server-only code (hooks, access checks) always sees real staff status
 * regardless of which route triggered it.
 */
export function toPublicUser(user: User | undefined): User | undefined {
  if (!user) return undefined;
  const clean: Dic = { ...user };
  for (const key of PRIVATE_FIELDS) {
    delete clean[key];
  }
  return clean as User;
}
