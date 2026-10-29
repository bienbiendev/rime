/** The collection auth derives for panel sign-in. Its users carry it as their better-auth `type`. */
export const STAFF_SLUG = 'staff';

/**
 * The document roles rime names itself. `ADMIN` passes every admin-only check, wherever it is
 * listed; rime adds it to the staff collection. `STAFF` is the role a staff member gets when the
 * config names no other, `USER` the default role of every other auth collection.
 *
 * These are rime roles, read from a document's `roles`. The better-auth roles in
 * `BETTER_AUTH_ROLES` are spelled the same and are a different thing.
 */
export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  USER: 'user'
} as const;
