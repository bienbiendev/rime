import type { Dic } from '$lib/util/types.js';
import type { User } from './types.js';

/**
 * The members of an auth document that never leave the server.
 *
 * `.server` is the guarantee, not a filing convention: nothing client-reachable may import this,
 * so nothing can ship a copy of the list to a browser or drift from it. Anything that needs it on
 * the client's behalf goes through the server — see `auth/blank/module.server.ts`.
 */
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

/** Every member of `PRIVATE_FIELDS`, off a copy of the document. */
export function withoutPrivateFields<T extends Dic>(doc: T): T {
  const clean = { ...doc };
  for (const key of PRIVATE_FIELDS) {
    delete clean[key];
  }
  return clean;
}

/**
 * Strips PRIVATE_FIELDS off the session user. Call this only where a load() function is
 * about to hand `user` to the client (the public layouts in
 * dev/codegen/routes/common.server.ts) — never on event.locals.user itself, which stays
 * the full object so server-only code (hooks, access checks) always sees real staff status
 * regardless of which route triggered it.
 */
export function toPublicUser(user: User | undefined): User | undefined {
  if (!user) return undefined;
  return withoutPrivateFields(user as Dic) as User;
}
