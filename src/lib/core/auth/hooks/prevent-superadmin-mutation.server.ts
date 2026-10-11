import { ROLES } from '#lib/core/auth/constant.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import { isSuperAdmin } from '#lib/core/auth/user.server.js';

/**
 * Guards the super-admin on rime's update: only the super-admin may change it, its roles always
 * keep 'admin', and no update outside init may write `isSuperAdmin`. better-auth's admin routes
 * that could change it are closed (`CLOSED_PATHS`, better-auth/config.server.ts).
 */
export const preventSuperAdminMutation = Hooks.beforeUpdate(
  async function preventSuperAdminMutation(args) {
    const { event, context } = args;
    const originalDoc = context.originalDoc;

    if (!originalDoc)
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing originalDoc @preventSuperAdminMutation'
      );

    const IS_ROLES_MUTATION = 'roles' in args.data && Array.isArray(args.data.roles);
    const IS_SUPERADMIN_MUTATION = await isSuperAdmin(event.locals.rime.adapter, originalDoc.id);

    // Only the super-admin changes the super-admin; rime's own system writes are not a caller
    if (IS_SUPERADMIN_MUTATION && !context.isSystemOperation && !event.locals.user?.isSuperAdmin) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }

    // Prevent "admin" roles of superadmin to be deleted
    if (IS_SUPERADMIN_MUTATION && IS_ROLES_MUTATION && !args.data.roles.includes(ROLES.ADMIN)) {
      args.data.roles.push(ROLES.ADMIN);
    }

    // Prevent superAdmin value to be changed
    if ('isSuperAdmin' in args.data && !event.locals.isInit) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }

    return args;
  }
);
