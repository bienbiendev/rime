import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_ROLES } from '$lib/core/collections/auth/constant.server.js';
import { logger } from '$lib/core/logger/index.server.js';
import { trycatch } from '$lib/util/function.js';
import { omit } from '$lib/util/object.js';
import type { AuthContext, MiddlewareContext, MiddlewareOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { createAuthMiddleware, type AuthMiddleware } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

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
    const user = await event.locals.rime.adapter.auth.getUserAttributes({
      authUserId: newSession.user.id,
      slug: newSession.user.type
    });
    if (!user) {
      logger.error(
        `cant' find user with authUser id ${newSession.user.id} from ${newSession.user.type} collection`
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
 * The creation of users handle from here is made for these two scenarios :
 * - public sign-up with better-auth
 * - create the first user via api/init
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
    const { authUsers } = event.locals.rime.adapter.tables;
    await event.locals.rime.adapter.db
      .update(authUsers)
      .set({
        role: BETTER_AUTH_ROLES.ADMIN
      })
      .where(eq(authUsers.id, newSession.user.id));

    // Create a placeholder user to authorize staff creation
    event.locals.user = {
      id: '1',
      name: 'system',
      email: 'admin@system.com',
      roles: ['admin'],
      isSuperAdmin: true
    };

    data.isSuperAdmin = true;
  }

  /**
   * Set isAutoSignIn flag to true to auto-populate the user document
   * after creation on event.locals.user, this tell the operation that
   * the creation is initiate by a better-auth sign-up
   */
  event.locals.isAutoSignIn = true;

  /**
   * Create the collection document
   */
  const [error] = await trycatch(() =>
    event.locals.rime
      .collection(ctx.body.type)
      .system(event.locals.isInit)
      .create({
        data: {
          ...omit(['password', 'type'], ctx.body),
          // explicit set roles to null if not from the init process,
          // it will be set to the default role value
          // better safe than wrong, this prevent the role prop to be set from
          // outside the panel
          roles: event.locals.isInit ? ['admin'] : null,
          authUserId: newSession.user.id
        }
      })
  );

  // If error clean up session/account/user created
  // Would be great to do it with the admin plugin,

  if (error) {
    console.log(error);
    logger.error(error.message);
    ctx.context.newSession = null;
    const { user } = newSession;
    const event = getRequestEvent();
    const { rime } = event.locals;
    const sessionTable = rime.adapter.tables.authSessions;
    const authAccountsTable = rime.adapter.tables.authAccounts;
    const authUsersTable = rime.adapter.tables.authUsers;
    await rime.adapter.db.delete(sessionTable).where(eq(sessionTable.userId, user.id));
    await rime.adapter.db.delete(authAccountsTable).where(eq(authAccountsTable.userId, user.id));
    await rime.adapter.db.delete(authUsersTable).where(eq(authUsersTable.id, user.id));
    throw new APIError('BAD_REQUEST');
  }
};

/****************************************************/
/* Before Hooks
/****************************************************/

const preventPublicStaffSignUp = (ctx: CTX): void => {
  // Prevent public staff sign-up
  const event = getRequestEvent();
  if (ctx.body.type === 'staff' && !event.locals.user?.isStaff && !event.locals.isInit) {
    throw new APIError('UNAUTHORIZED');
  }
};

/****************************************************/
/* exports
/****************************************************/

export const betterAuthBeforeHook: AuthMiddleware = createAuthMiddleware(async (ctx) => {
  if (ctx.path.startsWith('/sign-up')) {
    preventPublicStaffSignUp(ctx);
  }
});

export const betterAuthAfterHook: AuthMiddleware = createAuthMiddleware(async (ctx) => {
  // Handle sign-in
  if (ctx.path.startsWith('/sign-in')) {
    return await getUserAttributes(ctx);
  }

  // Handle sign-up
  if (ctx.path.startsWith('/sign-up')) {
    return await handleUserCreation(ctx);
  }
});
