import { ROLES } from './constant.js';
import type { User } from '#lib/core/auth/types.js';

/**
 * Whether the user's `roles` hold `admin`. Only `roles` is read, whatever collection the user
 * comes from: `handleAuth` has already refused an `admin` that better-auth does not back.
 *
 * @example
 * isAdmin({ roles: ['admin'], ... }) // true
 */
export const isAdmin = (user?: User) => !!user && hasRoles(user, ROLES.ADMIN);

/**
 * Checks if a user is from the staff collection.
 *
 * @example
 * isStaff({ isStaff: true, ... }) // true
 */
export const isStaff = (user?: User) => !!user && !!user.isStaff;

/**
 * Checks if a user has any of the specified roles.
 *
 * @example
 * // Check if user has either editor or reviewer role
 * if (hasRoles(user, 'editor', 'reviewer')) {
 *   // Allow access to editing features
 * }
 */
export const hasRoles = (user?: User, ...roles: string[]) =>
  !!user && user.roles.some((role) => roles.includes(role));

/**
 * Checks if a user's ID matches the specified ID.
 * Used for operations that should only be allowed for the user themselves.
 *
 * @example
 * // Check if user is accessing their own settings
 * if (isMe(currentUser, requestedUserId)) {
 *   // Allow access to personal settings
 * }
 */
export const isMe = (user?: User, id?: string) => {
  return !!(user && id === user.id);
};

/**
 * Checks if a user is an admin or matches the specified ID.
 * Useful for operations that should be allowed for admins or the user themselves.
 *
 * @example
 * // Check if user can edit a profile (either as admin or as the profile owner)
 * if (isAdminOrMe(currentUser, profileId)) {
 *   // Allow profile editing
 * }
 */
export const isAdminOrMe = (user?: User, id?: string) => isAdmin(user) || isMe(user, id);

/** The access helpers, as `rimecms/util` publishes them. */
export const access = { isAdmin, hasRoles, isAdminOrMe, isMe, isStaff };
