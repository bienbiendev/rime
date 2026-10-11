import { ROLES, STAFF_SLUG } from '#lib/core/auth/constant.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { dev } from '$app/env';
import { RimeError, RimeFormError } from '#lib/core/errors/index.js';
import { access } from '#lib/core/auth/access.js';
import { t__ } from '#lib/core/i18n/index.js';
import { BETTER_AUTH_ROLES } from '#lib/core/auth/constant.server.js';
import type { Dic } from '#lib/util/types.js';

/** better-auth makes a user with no credential account when the password is missing. */
const requirePassword = (data: Dic) => {
  if (!data.password) throw new RimeFormError({ password: RimeFormError.REQUIRED_FIELD });
};

/**
 * Create a better-auth user before a document creation
 */
export const createBetterAuthUser = Hooks.beforeCreate<'auth'>(
  async function createBetterAuthUser(args) {
    const { config, event } = args;
    const { rime } = event.locals;

    const IS_API_KEY_OPERATION = config.auth?.type === 'apiKey';
    const ADMIN_ROLE_IN_DATA =
      Array.isArray(args.data.roles) && args.data.roles.includes(ROLES.ADMIN);
    const IS_CURRENT_USER_ADMIN = access.isAdmin(event.locals.user);
    const IS_CURRENT_USER_STAFF = Boolean(event.locals.user?.isStaff);
    const IS_STAFF_CREATION = config.slug === STAFF_SLUG;
    const ADMIN_ROLE_ALLOWED =
      IS_STAFF_CREATION &&
      Boolean(
        config.auth?.roles?.some(
          (role) => (typeof role === 'string' ? role : role.value) === ROLES.ADMIN
        )
      );

    const CREATION_CASE = {
      INIT: 'INIT',
      ADMIN_CREATE_USER: 'ADMIN_CREATE_USER',
      STAFF_CREATE_USER: 'STAFF_CREATE_USER',
      PUBLIC_SIGNUP: 'PUBLIC_SIGNUP',
      API_KEY_CREATION: 'API_KEY_CREATION'
    } as const;

    /**
     * Which creation path this request is on. First match wins, read top to bottom.
     *
     * Written as a plain if/else-if chain: the conditions are not mutually exclusive and the
     * order between them is the actual logic, so it should read as control flow.
     */
    const resolveCase = (): (typeof CREATION_CASE)[keyof typeof CREATION_CASE] | undefined => {
      /**
       * 1. First-time Setup (Init)
       * 	- Description: Creating the first admin user when the system is initialized
       *		- Actor: No authenticated user exists yet
       *		- Auth Flow: better-auth's after-hook has made the user and set its 'admin'
       *		  role (`setAuthUserRole`); this case copies `data.authUserId`. It is the only
       *		  isSuperAdmin user.
       */
      if (Boolean(event.locals.isInit) && dev) return CREATION_CASE.INIT;

      /**
       *	2. Admin Creating Users
       *		- Description: Admin creates any users through the panel
       *		- Actor: Authenticated admin user
       *		- Auth Flow:
       *			- Use the admin plugin to create a user
       */
      if (IS_CURRENT_USER_ADMIN && !IS_API_KEY_OPERATION) return CREATION_CASE.ADMIN_CREATE_USER;

      /*
       * 3. Staff Creating users
       *		- Description: Any panel user (staff collection) non admin, creating other users
       *		- Actor: Authenticated staff user
       *		- Auth Flow: the admin plugin creates the user with the 'staff' or 'user' role
       */
      if (IS_CURRENT_USER_STAFF && !IS_API_KEY_OPERATION) return CREATION_CASE.STAFF_CREATE_USER;

      /*
       * 4. Public User Signup
       * 	- Description: End users registering themselves or signing in with a social provider
       * 	- Actor: Unauthenticated visitor
       * 	- Auth Flow:
       * 		- User submits signup form
       * 		- Better-Auth creates user with 'user' role
       * 		- Better-Auth hook sets event.locals.pendingSignInAfterSignUp and calls
       * 		  rime.collection(slug).create with the new authUserId
       * 	- An `authUserId` a caller sends without that flag takes no part in the choice
       */
      if (event.locals.pendingSignInAfterSignUp && args.data.authUserId) {
        return CREATION_CASE.PUBLIC_SIGNUP;
      }

      /**
       * 5. API Key Creation
       * 	- Description: Creating an API KEY
       * 	- Actor: Authenticated user
       * 	-	Auth Flow:
       * 		- Admin creates API key user that forward current authenticated user
       * 		- API key generated and send by email
       */
      if (
        IS_API_KEY_OPERATION &&
        Boolean(event.locals.user) &&
        Boolean(event.locals.betterAuthUser?.id)
      )
        return CREATION_CASE.API_KEY_CREATION;

      return undefined;
    };

    const CASE = resolveCase();

    // Prevent superAdmin value to be set on creation
    if ('isSuperAdmin' in args.data && CASE !== CREATION_CASE.INIT) {
      throw new RimeError(RimeError.UNAUTHORIZED);
    }

    let authUserId;

    switch (CASE) {
      case CREATION_CASE.INIT:
        authUserId = args.data.authUserId;
        break;

      case CREATION_CASE.ADMIN_CREATE_USER: {
        // Define better-auth role
        // First match wins, read top to bottom.
        const role =
          ADMIN_ROLE_IN_DATA && ADMIN_ROLE_ALLOWED
            ? BETTER_AUTH_ROLES.ADMIN
            : !ADMIN_ROLE_IN_DATA && IS_STAFF_CREATION
              ? BETTER_AUTH_ROLES.STAFF
              : BETTER_AUTH_ROLES.USER;

        requirePassword(args.data);
        const result = await rime.auth.api.createUser({
          headers: args.event.request.headers,
          body: {
            email: args.data.email,
            password: args.data.password,
            name: args.data.name,
            data: {
              type: config.slug
            },
            role
          }
        });
        authUserId = result.user.id;
        break;
      }

      case CREATION_CASE.STAFF_CREATE_USER: {
        // Define better-auth role, staff can't create admin
        const role = IS_STAFF_CREATION ? BETTER_AUTH_ROLES.STAFF : BETTER_AUTH_ROLES.USER;

        // Without headers: rime's create access already let this staff member in, and the role is
        // never 'admin'. With them, better-auth would ask for a `set-role` the staff role lacks.
        requirePassword(args.data);
        const result = await rime.auth.api.createUser({
          body: {
            email: args.data.email,
            password: args.data.password,
            name: args.data.name,
            data: {
              type: config.slug
            },
            role
          }
        });
        authUserId = result.user.id;
        break;
      }

      case CREATION_CASE.API_KEY_CREATION: {
        if (!event.locals.betterAuthUser || !event.locals.user) {
          throw new RimeError(RimeError.UNAUTHORIZED);
        }
        // A key document's `ownerId` names a staff member (auth/augment.server.ts)
        if (!event.locals.user.isStaff) {
          throw new RimeError(RimeError.UNAUTHORIZED, 'an api key belongs to a staff member');
        }
        if (!rime.mailer) {
          throw new RimeError(
            RimeError.OPERATION_ERROR,
            `Can't create API KEY without smtp config`
          );
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

        // Send api key by email to the user
        // Cast as any because when no SMTP config provided by consumer rime.mailer is never
        await (rime.mailer as any).sendMail({
          to: event.locals.user!.email,
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
      }

      case CREATION_CASE.PUBLIC_SIGNUP:
        authUserId = args.data.authUserId;
        break;

      /**
       * Any other case : throw UNAUTHORIZED
       *  - unauthenticated user using direct API calls ex: POST /api/staff
       */
      default:
        throw new RimeError(RimeError.UNAUTHORIZED);
    }

    return {
      ...args,
      data: {
        ...args.data,
        authUserId: authUserId
      }
    };
  }
);
