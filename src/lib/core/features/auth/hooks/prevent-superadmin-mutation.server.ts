import { RimeError } from '$lib/core/errors/index.js';
import { isSuperAdmin } from '../user.server.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';

/**
 * Before update :
 * - prevent superadmin to be changed by someone else
 */
export const preventSuperAdminMutation = Hooks.beforeUpdate({
  name: 'preventSuperAdminMutation',
  feature: 'auth',
  // Runs before anything adds to `data`: this reads the caller's submission as sent.
  run: async (args) => {
    const { event, context } = args;
    const originalDoc = context.originalDoc;

    if (!originalDoc)
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing originalDoc @preventSuperAdminMutation'
      );

    const IS_ROLES_MUTATION = 'roles' in args.data && Array.isArray(args.data.roles);
    const IS_SUPERADMIN_MUTATION = await isSuperAdmin(event.locals.rime.adapter, originalDoc.id);

    // Prevent super admin user to be changed by someone
    if (IS_SUPERADMIN_MUTATION && !event.locals.user?.isSuperAdmin) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }

    // Prevent "admin" roles of superadmin to be deleted
    if (IS_SUPERADMIN_MUTATION && IS_ROLES_MUTATION && !args.data.roles.includes('admin')) {
      args.data.roles.push('admin');
    }

    // Prevent superAdmin value to be changed
    if ('isSuperAdmin' in args.data && !event.locals.isInit) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }

    return args;
  }
});
