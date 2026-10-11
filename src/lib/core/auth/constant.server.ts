import type { Dic } from '#lib/util/types.js';
import type { User } from './types.js';

/**
 * The members of an auth document that never leave the server.
 *
 * Server-only, so the list never reaches a browser bundle. Documents leave the server stripped by
 * `removePrivateFields` (`auth/hooks/remove-private-fields.server.ts`), and users by `toPublicUser`.
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
 * Strips `PRIVATE_FIELDS` off the session user, for a load() that hands `user` to the client.
 * `event.locals.user` keeps the full object.
 */
export function toPublicUser(user: User | undefined): User | undefined {
  if (!user) return undefined;
  return withoutPrivateFields(user as Dic) as User;
}
