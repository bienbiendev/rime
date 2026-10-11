import { ROLES, STAFF_SLUG } from '#lib/core/auth/constant.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import { access } from '#lib/core/auth/access.js';
import { BETTER_AUTH_ROLES } from '#lib/core/auth/constant.server.js';
import { betterAuthApiKey, betterAuthUserId } from '#lib/core/auth/user.server.js';

/**
 * Syncs a staff document's `roles` to its better-auth role: 'admin' when an admin grants admin,
 * 'staff' otherwise.
 *
 * Better-auth only knows one `role`: admin, staff, or user. On every other collection it is 'user'
 * from creation on and never changes, so there is nothing to forward.
 */
export const forwardRolesToBetterAuth = Hooks.beforeUpdate<'auth'>(
  async function forwardRolesToBetterAuth(args) {
    const { event, config, context } = args;
    const { rime } = event.locals;

    if (config.slug !== STAFF_SLUG || !Array.isArray(args.data.roles)) {
      return args;
    }

    const originalDoc = context.originalDoc;

    if (!originalDoc) {
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing originalDoc @forwardRolesToBetterAuth'
      );
    }

    const authUserId = await betterAuthUserId(rime.adapter, {
      slug: config.slug,
      id: originalDoc.id
    });

    if (!authUserId) {
      throw new RimeError(RimeError.OPERATION_ERROR, 'user not found');
    }

    // Only an admin can grant 'admin'.
    const role =
      access.isAdmin(event.locals.user) && args.data.roles.includes(ROLES.ADMIN)
        ? BETTER_AUTH_ROLES.ADMIN
        : BETTER_AUTH_ROLES.STAFF;

    // With the caller's headers: better-auth's `set-role` check and the `roles` field's `update`
    // rule both say admins only.
    await rime.auth.api.setRole({
      headers: args.event.request.headers,
      body: { userId: authUserId, role }
    });

    return args;
  }
);

/**
 * Gives an api key the roles its document is saved with, so a request made with the key carries
 * them. Placed after `validateFields`: `roles` is in `data` only when the caller may change it.
 *
 * `updateApiKey` without headers is better-auth's server-side form: it accepts `permissions` and
 * only checks that `userId` is the key's creator.
 */
export const forwardRolesToApiKey = Hooks.beforeUpdate<'auth'>(
  async function forwardRolesToApiKey(args) {
    const { event, config, context, data } = args;

    if (config.auth?.type !== 'apiKey' || !Array.isArray(data.roles) || !context.originalDoc) {
      return args;
    }

    // Only an admin gives a key 'admin': the key passes as admin wherever it is sent. A role the
    // document already holds may stay, whoever saves it.
    const grantsAdmin =
      data.roles.includes(ROLES.ADMIN) && !context.originalDoc.roles?.includes(ROLES.ADMIN);
    if (grantsAdmin && !context.isSystemOperation && !access.isAdmin(event.locals.user)) {
      throw new RimeError(RimeError.UNAUTHORIZED, 'only an admin gives a key admin');
    }

    const { rime } = event.locals;
    const key = await betterAuthApiKey(rime.adapter, {
      slug: config.slug,
      id: context.originalDoc.id
    });

    if (!key) {
      return args;
    }

    await rime.auth.api.updateApiKey({
      body: { keyId: key.keyId, userId: key.userId, permissions: { roles: data.roles } }
    });

    return args;
  }
);
