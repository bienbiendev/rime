import { dev } from '$app/environment';
import { RimeError, RimeFormError } from '$lib/core/errors/index.js';
import { t__ } from '$lib/core/i18n/index.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { access } from '$lib/util/access/index.js';
import { cases } from '$lib/util/cases.js';
import { BETTER_AUTH_ROLES } from '../../constant.server.js';

/**
 * Create a better-auth user before a document creation
 */
export const createBetterAuthUser = Hooks.beforeCreate<'auth'>(async (args) => {
	const { config, event } = args;
	const { rime } = event.locals;

	if (!config.auth) return args;

	const IS_API_KEY_OPERATION = config.auth?.type === 'apiKey';
	const ADMIN_ROLE_IN_DATA =
		Array.isArray(args.data.roles) && args.data.roles.includes(BETTER_AUTH_ROLES.ADMIN);
	const IS_CURRENT_USER_ADMIN = access.isAdmin(event.locals.user);
	const IS_CURRENT_USER_STAFF = Boolean(event.locals.user?.isStaff);
	const IS_STAFF_CREATION = config.slug === 'staff';
	const ADMIN_ROLE_ALLOWED = IS_STAFF_CREATION && Boolean(config.auth?.roles?.includes('admin'));

	const CASE = cases({
		/**
		 * 1. First-time Setup (Init)
		 * 	- Description: Creating the first admin user when the system is initialized
		 *		- Actor: No authenticated user exists yet
		 *			- Auth Flow:
		 *				- event.locals.isInit = true is set
		 *				- use admin plugin to creates user with "admin" role
		 *				- this will be the only isSuperAdmin user
		 */
		INIT: Boolean(event.locals.isInit) && dev,

		/**
		 *	2. Admin Creating Users
		 *		- Description: Admin creates any users through the panel
		 *		- Actor: Authenticated admin user
		 *		- Auth Flow:
		 *			- Use the admin plugin to create a user
		 */
		ADMIN_CREATE_USER: IS_CURRENT_USER_ADMIN && !IS_API_KEY_OPERATION,

		/*
		 * 3. Staff Creating users
		 *		- Description: Any panel user (staff collection) non admin, creating other users
		 *		- Actor: Authenticated staff user
		 *		- Auth Flow:
		 *			- ??
		 */
		STAFF_CREATE_USER: IS_CURRENT_USER_STAFF && !IS_API_KEY_OPERATION,

		/*
		 * 4. Public User Signup
		 * 	- Description: End users registering themselves or sigin with social Provider
		 * 	- Actor: Unauthenticated visitor
		 * 	- Auth Flow:
		 * 		- User submits signup form
		 * 		- Better-Auth creates user with 'user' role
		 * 		- Better-Auth hook call rime.collection(slug).create to create the document
		 */
		PUBLIC_SIGNUP: Boolean(args.data.authUserId),

		/**
		 * 6. API Key Creation
		 * 	- Description: Creating an API KEY
		 * 	- Actor: Authenticated user
		 * 	-	Auth Flow:
		 * 		- Admin creates API key user that forward current authneticated user
		 * 		- API key generated and send by email
		 */
		API_KEY_CREATION:
			IS_API_KEY_OPERATION && Boolean(event.locals.user) && Boolean(event.locals.betterAuthUser?.id)

		/**
		 * 7. Programmatic User Creation : API_KEY APP create user
		 * 	- Description: Creating an API KEY
		 * 	- Actor: Authenticated user related to the API_KEY
		 * 	- equivalent to ADMIN_CREATE_USER or STAFF_CREATE_USER
		 *
		 * Not implemented :
		 * 8. Invitation-based User Creation
		 */
	});

	// Prevent superAdmin value to be set on creation
	if ('isSuperAdmin' in args.data && CASE.value !== CASE.INIT) {
		throw new RimeError(RimeError.UNAUTHORIZED);
	}

	let authUserId;

	switch (CASE.value) {
		case CASE.INIT:
			authUserId = args.data.authUserId;
			break;

		case CASE.ADMIN_CREATE_USER: {
			// Define better-auth role
			const role = cases({
				[BETTER_AUTH_ROLES.ADMIN]: ADMIN_ROLE_IN_DATA && ADMIN_ROLE_ALLOWED,
				[BETTER_AUTH_ROLES.STAFF]: !ADMIN_ROLE_IN_DATA && IS_STAFF_CREATION,
				[BETTER_AUTH_ROLES.USER]: true
			});

			const result = await rime.auth.api.createUser({
				headers: args.event.request.headers,
				body: {
					email: args.data.email,
					password: args.data.password,
					name: args.data.name,
					data: {
						type: config.slug
					},
					role: role.value
				}
			});
			authUserId = result.user.id;
			break;
		}

		//
		case CASE.STAFF_CREATE_USER: {
			// Define better-auth role, staff can't create admin
			const role = cases({
				[BETTER_AUTH_ROLES.STAFF]: IS_STAFF_CREATION,
				[BETTER_AUTH_ROLES.USER]: true
			});

			const result = await rime.auth.api.createUser({
				headers: args.event.request.headers,
				body: {
					email: args.data.email,
					password: args.data.password,
					name: args.data.name,
					data: {
						type: config.slug
					},
					role: role.value
				}
			});
			authUserId = result.user.id;
			break;
		}

		case CASE.API_KEY_CREATION: {
			if (!event.locals.betterAuthUser || !event.locals.user) {
				throw new RimeError(RimeError.UNAUTHORIZED);
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
						roles: args.data.roles || [BETTER_AUTH_ROLES.USER]
					}
				}
			});

			// Send api key by email to the user
			await rime.mailer.sendMail({
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

		case CASE.PUBLIC_SIGNUP:
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
});
