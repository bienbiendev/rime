import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { access } from '$lib/util/access/index.js';
import { cases } from '$lib/util/cases.js';
import { BETTER_AUTH_ROLES } from '../../constant.server.js';

/**
 *  Before update : set proper better-auth role
 */
export const forwardRolesToBetterAuth = Hooks.beforeUpdate<'auth'>(async (args) => {
  const { event, config, context } = args;
  const { rime } = event.locals;

  if (args.context.isFallbackLocale) return args;

  const IS_ROLES_MUTATION = 'roles' in args.data && Array.isArray(args.data.roles);
  const IS_API_KEY_MUTATION = config.auth?.type === 'apiKey';

  // Never forward roles for APIKey roles mutation
  // ApiKey doens't have a proper betterAuthUser,
  // so prevent forwarding roles to the betterAuthUser owner of the apiKey
  if (IS_API_KEY_MUTATION) {
    return args;
  }

  const originalDoc = context.originalDoc;

  if (!originalDoc)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @forwardRolesToBetterAuth');

  if (IS_ROLES_MUTATION) {
    // get the better-auth userId
    const authUserId = await rime.adapter.auth.getAuthUserId({
      slug: config.slug,
      id: originalDoc.id
    });

    if (!authUserId) {
      throw new RimeError(RimeError.OPERATION_ERROR, 'user not found');
    }

    // Assign proper better-auth role based on who perform action,
    // on wich collection, and the data.roles value
    const ADMIN_ROLE_IN_DATA = Array.isArray(args.data.roles) && args.data.roles.includes('admin');
    const IS_CURRENT_USER_ADMIN = access.isAdmin(event.locals.user);
    const IS_CURRENT_USER_STAFF = Boolean(event.locals.user?.isStaff);

    const role = cases({
      // Only admins can set others staff users the 'admin' role
      [BETTER_AUTH_ROLES.ADMIN]:
        IS_CURRENT_USER_ADMIN && ADMIN_ROLE_IN_DATA && config.slug === 'staff',
      // If not an admin action, or there is no admin role in data
      // but it's a staff collection mutation and executed by any staff user then set 'staff'
      [BETTER_AUTH_ROLES.STAFF]: IS_CURRENT_USER_STAFF && config.slug === 'staff',
      // Any other case set 'user'
      [BETTER_AUTH_ROLES.USER]: true
    });

    await rime.auth.api.setRole({
      headers: args.event.request.headers,
      body: { userId: authUserId, role: role.value }
    });
  }

  return args;
});
