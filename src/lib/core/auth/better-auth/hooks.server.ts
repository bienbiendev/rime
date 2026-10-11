import { ROLES } from '#lib/core/auth/constant.js';
import { dev } from '$app/env';
import { getRequestEvent } from '$app/server';
import { deleteAuthUser, setAuthUserRole } from '#lib/core/auth/better-auth-tables.server.js';
import { BETTER_AUTH_ROLES } from '#lib/core/auth/constant.server.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import { userAttributes } from '#lib/core/auth/user.server.js';
import { logger } from '#lib/core/logger.server.js';
import { trycatch } from '#lib/util/function.js';
import { omit } from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import type { AuthContext, MiddlewareContext, MiddlewareOptions } from 'better-auth';
import { APIError, createAuthMiddleware, type AuthMiddleware } from 'better-auth/api';

type CTX = MiddlewareContext<
  MiddlewareOptions,
  AuthContext & {
    returned?: unknown;
    responseHeaders?: Headers;
  }
>;

/****************************************************/
/* After hooks
/****************************************************/

const getUserAttributes = async (ctx: CTX) => {
  const newSession = ctx.context.newSession;

  if (newSession) {
    const event = getRequestEvent();
    const user = await userAttributes(event.locals.rime.adapter, {
      authUserId: newSession.user.id,
      slug: newSession.user.type
    });
    if (!user) {
      logger.error(
        `can't find user with authUser id ${newSession.user.id} from ${newSession.user.type} collection`
      );
      throw new APIError('BAD_REQUEST');
    }
    return ctx.json({
      user: {
        email: user.email,
        name: user.name,
        id: user.id
      }
    });
  }
};

/**
 * Creates the collection document for a new Better-auth user: on public sign-up, and for the
 * first user via api/init.
 */
const handleUserCreation = async (ctx: CTX) => {
  const newSession = ctx.context.newSession;
  if (!newSession) return;

  const event = getRequestEvent();
  const data = ctx.body;

  /**
   * Handle first user creation,
   * - set its role to admin
   * - set isSuperAdmin to true
   */
  if (event.locals.isInit && dev) {
    await setAuthUserRole(event.locals.rime.adapter, {
      authUserId: newSession.user.id,
      role: BETTER_AUTH_ROLES.ADMIN
    });

    // Create a placeholder user to authorize staff creation
    event.locals.user = {
      id: '1',
      name: 'system',
      email: 'admin@system.com',
      roles: [ROLES.ADMIN],
      isStaff: true,
      isSuperAdmin: true
    };

    data.isSuperAdmin = true;
  }

  /**
   * Marks the create below as a better-auth sign-up: `createBetterAuthUser` keeps the
   * `authUserId` it carries, and `signInNewUser` signs the new user in.
   */
  event.locals.pendingSignInAfterSignUp = true;

  /**
   * Create the collection document
   */
  const [error] = await trycatch(() =>
    event.locals.rime
      .collection(ctx.body.type)
      // As rime only for the init; a sign-up is checked as the caller, like any create
      .system(!!event.locals.isInit)
      .create({
        data: {
          ...omit(['password', 'type'], ctx.body),
          // Outside init, `null` applies the default role.
          roles: event.locals.isInit ? [ROLES.ADMIN] : null,
          authUserId: newSession.user.id
        }
      })
  );

  // If error clean up session/account/user created
  if (error) {
    logger.error(error.message);
    ctx.context.newSession = null;
    const { user } = newSession;
    const event = getRequestEvent();
    const { rime } = event.locals;
    await deleteAuthUser(rime.adapter, { authUserId: user.id });
    throw new APIError('BAD_REQUEST');
  }
};

/****************************************************/
/* Before Hooks
/****************************************************/

/**
 * A sign-up goes to an auth collection of `password` type that lets this request create, as any
 * create would; checked before better-auth writes its account. The init, which creates the first
 * admin, is rime's own.
 *
 * ```ts
 * // users: access.create () => true
 * { type: 'users' }  // signs up
 * { type: 'staff' }  // UNAUTHORIZED: staff create is admin-only
 * { type: 'pages' }  // UNAUTHORIZED: not an auth collection
 * ```
 */
const preventRefusedSignUp = (ctx: CTX): void => {
  const event = getRequestEvent();
  if (event.locals.isInit) return;

  const collections = event.locals.rime.config.collections as Dic<BuiltCollection | undefined>;
  const config = collections[ctx.body.type];
  const signsUp = typeof config?.auth === 'object' && config.auth.type === 'password';
  if (!signsUp || !config.access.create(event.locals.user, { event })) {
    throw new APIError('UNAUTHORIZED');
  }
};

/****************************************************/
/* exports
/****************************************************/

export const betterAuthBeforeHook: AuthMiddleware = createAuthMiddleware(async (ctx) => {
  if (ctx.path.startsWith('/sign-up')) {
    preventRefusedSignUp(ctx);
  }
});

export const betterAuthAfterHook: AuthMiddleware = createAuthMiddleware(async (ctx) => {
  // Handle sign-in
  if (ctx.path.startsWith('/sign-in')) {
    return await getUserAttributes(ctx);
  }

  // Handle sign-up
  if (ctx.path.startsWith('/sign-up')) {
    await handleUserCreation(ctx);
    return await getUserAttributes(ctx);
  }
});
