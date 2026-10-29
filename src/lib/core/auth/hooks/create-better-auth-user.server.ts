import { ROLES, STAFF_SLUG } from '#lib/core/auth/constant.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import type { HookContext } from '#lib/core/pipeline/types.js';
import { dev } from '$app/env';
import { RimeError, RimeFormError } from '#lib/core/errors/index.js';
import { access } from '#lib/core/auth/access.js';
import { t__ } from '#lib/core/i18n/index.js';
import { BETTER_AUTH_ROLES } from '#lib/core/auth/constant.server.js';
import type { Dic } from '#lib/util/types.js';

type Args = HookContext<'auth', 'create', 'before'>;

type CreationPath = 'init' | 'admin' | 'staff' | 'signup' | 'apiKey';

/** better-auth makes a user with no credential account when the password is missing. */
const requirePassword = (data: Dic) => {
  if (!data.password) throw new RimeFormError({ password: RimeFormError.REQUIRED_FIELD });
};

/**
 * Which way a new auth document gets its better-auth user. First match wins:
 *
 * ```
 * init     the dev-only init: better-auth made the first admin, the document copies its id
 * admin    a rime admin creates a user of any auth collection but an api-key one
 * staff    a staff member creates a user of any auth collection but an api-key one
 * signup   better-auth's `/sign-up/email`: better-auth made the user, and its after-hook calls
 *          this create with the new `authUserId`
 * apiKey   a signed-in caller with a better-auth user creates an api-key document
 * ```
 *
 * `undefined` for anything else: an anonymous `POST /api/staff`, say. An `authUserId` sent
 * outside a sign-up takes no part in the choice.
 */
const creationPath = ({ config, event, data }: Args): CreationPath | undefined => {
  const isApiKey = config.auth?.type === 'apiKey';
  const { user, betterAuthUser } = event.locals;
  if (event.locals.isInit && dev) return 'init';
  if (access.isAdmin(user) && !isApiKey) return 'admin';
  if (user?.isStaff && !isApiKey) return 'staff';
  if (event.locals.pendingSignInAfterSignUp && data.authUserId) return 'signup';
  if (isApiKey && user && betterAuthUser?.id) return 'apiKey';
  return undefined;
};

/**
 * Makes the better-auth user of a new auth document, or copies the one better-auth already made,
 * and puts its id on the document as `authUserId`. An api-key document gets a key, and the
 * caller's better-auth user as its `authUserId`.
 */
export const createBetterAuthUser = Hooks.beforeCreate<'auth'>(
  async function createBetterAuthUser(args) {
    const path = creationPath(args);

    // Only the init sets `isSuperAdmin`.
    if ('isSuperAdmin' in args.data && path !== 'init') {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }

    switch (path) {
      case 'init':
      case 'signup':
        return withAuthUserId(args, args.data.authUserId);
      case 'admin':
        return withAuthUserId(
          args,
          await createAuthUser(args, adminRole(args), { headers: args.event.request.headers })
        );
      case 'staff':
        return withAuthUserId(args, await createAuthUser(args, staffRole(args)));
      case 'apiKey':
        return createKeyDocument(args);
      default:
        throw new RimeError(RimeError.UNAUTHORIZED);
    }
  }
);

/** The args with `authUserId` on the data. */
const withAuthUserId = (args: Args, authUserId: Args['data']['authUserId']): Args => ({
  ...args,
  data: { ...args.data, authUserId }
});

/**
 * The better-auth role an admin's create gives: `admin` to a staff member whose roles hold it,
 * `staff` to any other staff member, `user` on every other collection.
 */
const adminRole = ({ config, data }: Args) => {
  if (config.slug !== STAFF_SLUG) return BETTER_AUTH_ROLES.USER;
  return Array.isArray(data.roles) && data.roles.includes(ROLES.ADMIN)
    ? BETTER_AUTH_ROLES.ADMIN
    : BETTER_AUTH_ROLES.STAFF;
};

/**
 * The better-auth role a staff member's create gives: `staff` on the staff collection, `user` on
 * any other. Never `admin`.
 */
const staffRole = ({ config }: Args) =>
  config.slug === STAFF_SLUG ? BETTER_AUTH_ROLES.STAFF : BETTER_AUTH_ROLES.USER;

/**
 * Makes the better-auth user and answers its id. With the caller's headers, better-auth checks
 * its own `create` and `set-role` statements, as for an admin. Without them it checks nothing: a
 * staff member's create, which rime's access already let in. The staff role lacks `set-role`.
 */
const createAuthUser = async (
  args: Args,
  role: (typeof BETTER_AUTH_ROLES)[keyof typeof BETTER_AUTH_ROLES],
  request: { headers?: Headers } = {}
) => {
  requirePassword(args.data);
  const result = await args.event.locals.rime.auth.api.createUser({
    ...request,
    body: {
      email: args.data.email,
      password: args.data.password,
      name: args.data.name,
      data: {
        type: args.config.slug
      },
      role
    }
  });
  return result.user.id;
};

/**
 * Makes the api key for the caller's better-auth user, with the document's roles, and mails it to
 * the caller. The document gets the key's id, the caller's better-auth user, and the caller as
 * its owner; `context.apiKey` holds the key for this request only.
 */
const createKeyDocument = async (args: Args): Promise<Args> => {
  const { event } = args;
  const { rime } = event.locals;

  if (!event.locals.betterAuthUser || !event.locals.user) {
    throw new RimeError(RimeError.UNAUTHORIZED);
  }
  // A key document's `ownerId` names a staff member (auth/augment.server.ts)
  if (!event.locals.user.isStaff) {
    throw new RimeError(RimeError.UNAUTHORIZED, 'an api key belongs to a staff member');
  }
  if (!rime.mailer) {
    throw new RimeError(RimeError.OPERATION_ERROR, `Can't create API KEY without smtp config`);
  }
  if (!args.data.name) {
    throw new RimeFormError({ name: RimeFormError.REQUIRED_FIELD });
  }

  const apiKey = await rime.auth.api.createApiKey({
    body: {
      name: args.data.name,
      userId: event.locals.betterAuthUser.id,
      permissions: {
        roles: args.data.roles || [ROLES.USER]
      }
    }
  });

  // `rime.mailer` is typed `never` when the app has no smtp config.
  await (rime.mailer as any).sendMail({
    to: event.locals.user.email,
    subject: t__(`mail.api_key_created_subject`, args.data.name),
    text: t__(`mail.api_key_created_text`, args.data.name, apiKey.key)
  });

  return {
    ...args,
    context: {
      ...args.context,
      apiKey: apiKey.key
    },
    data: {
      ...args.data,
      apiKeyId: apiKey.id,
      authUserId: event.locals.betterAuthUser.id,
      ownerId: event.locals.user.id
    }
  };
};
