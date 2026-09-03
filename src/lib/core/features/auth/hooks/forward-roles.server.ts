import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';
import { access } from '$lib/core/features/auth/access.js';
import { BETTER_AUTH_ROLES } from '../constant.server.js';

/**
 * Syncs this doc's `roles` field to better-auth's role.
 *
 * Rime's `roles` array is app-level, free-form per collection.
 * Better-auth only knows one `role`: admin, staff, or user.
 * When an update changes `roles`, this hook works out the right
 * better-auth role and saves it on the better-auth user.
 *
 * Only the 'staff' collection can end up admin or staff.
 * Every other collection always gets 'user'.
 */
export const forwardRolesToBetterAuth = Hooks.beforeUpdate<'auth'>({
  name: 'forwardRolesToBetterAuth',
  requires: ['original-doc'],
  // Runs before anything adds to `data`: this reads the caller's submission as sent.
  provides: ['data-inspected'],
  run: async (args) => {
    const { event, config, context } = args;
    const { rime } = event.locals;

    // Fallback-locale writes are internal, not a real user action — skip.
    if (args.context.isFallbackLocale) return args;

    const IS_ROLES_MUTATION = 'roles' in args.data && Array.isArray(args.data.roles);
    const IS_API_KEY_MUTATION = config.auth?.type === 'apiKey';

    // API key docs have no better-auth user of their own — their `roles` field
    // permissions the key itself, so there's nothing to forward here.
    if (IS_API_KEY_MUTATION) {
      return args;
    }

    const originalDoc = context.originalDoc;

    if (!originalDoc) {
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing originalDoc @forwardRolesToBetterAuth'
      );
    }

    if (IS_ROLES_MUTATION) {
      const authUserId = await rime.adapter.auth.getBetterAuthUserId({
        slug: config.slug,
        id: originalDoc.id
      });

      if (!authUserId) {
        throw new RimeError(RimeError.OPERATION_ERROR, 'user not found');
      }

      const ADMIN_ROLE_IN_DATA =
        Array.isArray(args.data.roles) && args.data.roles.includes('admin');
      const IS_CURRENT_USER_ADMIN = access.isAdmin(event.locals.user);
      const IS_CURRENT_USER_STAFF = Boolean(event.locals.user?.isStaff);

      // First true condition wins, read top to bottom.
      const role =
        // Only an admin can grant 'admin', and only on the staff collection.
        IS_CURRENT_USER_ADMIN && ADMIN_ROLE_IN_DATA && config.slug === 'staff'
          ? BETTER_AUTH_ROLES.ADMIN
          : // Any staff member editing a staff doc without granting admin: 'staff'.
            IS_CURRENT_USER_STAFF && config.slug === 'staff'
            ? BETTER_AUTH_ROLES.STAFF
            : // Everything else (non-staff collection, or no condition above matched): 'user'.
              BETTER_AUTH_ROLES.USER;

      await rime.auth.api.setRole({
        headers: args.event.request.headers,
        body: { userId: authUserId, role }
      });
    }

    return args;
  }
});
