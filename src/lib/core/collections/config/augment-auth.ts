import type { Collection, CollectionAuthConfig } from '$lib/core/config/types.js';
import { select } from '$lib/fields/select/index.js';
import { text } from '$lib/fields/text/index.js';
import type { Option } from '$lib/types.js';
import { access } from '$lib/util/access/index.js';
import { usersFields } from '../auth/fields.js';

type Input = {
	slug: string;
	auth?: boolean | CollectionAuthConfig;
	fields?: Collection<any>['fields'];
};
export type WithNormalizedAuth<T> = Omit<T, 'auth'> & { auth?: CollectionAuthConfig };

const withNormalizedAuth = <T extends { auth?: boolean | CollectionAuthConfig }>(
	config: T
): WithNormalizedAuth<T> => {
	// Create a new object without the auth property
	const { auth, ...rest } = config;
	// Determine the normalized auth value
	let normalizedAuth: undefined | CollectionAuthConfig;

	if (typeof auth === 'boolean') {
		normalizedAuth = { type: 'password' };
	} else {
		normalizedAuth = auth;
	}

	// Return the new object with the normalized auth
	return {
		...rest,
		auth: normalizedAuth
	};
};

/**
 * Augment Auth collections :
 * - normalize config.auth
 * - add fields name, email fields
 * - check roles fields
 */
export const augmentAuth = <T extends Input>(config: T): WithNormalizedAuth<T> => {
	const normalizedAuthConfig = withNormalizedAuth(config);
	if (!normalizedAuthConfig.auth) return normalizedAuthConfig;

	// Augment Fields
	const IS_STAFF_COLLECTION = normalizedAuthConfig.slug === 'staff';
	const IS_GENERIC_COLLECTION = !IS_STAFF_COLLECTION;
	const IS_API_AUTH = normalizedAuthConfig.auth.type === 'apiKey';

	const roles = [...(normalizedAuthConfig.auth.roles || ['user'])];
	let normalizedRoles: Option[] = roles.map((r) => (typeof r === 'string' ? { value: r } : r));

	// Filter out 'admin' roles for non staff collection
	normalizedRoles = IS_GENERIC_COLLECTION
		? normalizedRoles.filter((role) => role.value !== 'admin')
		: normalizedRoles;

	const defaultRole = normalizedRoles.filter((r) => r.value !== 'admin')[0];

	if (!defaultRole) {
		throw Error('Missing default role');
	}

	// Define role field
	const rolesField = select('roles')
		.options(...roles)
		.defaultValue([defaultRole.value])
		.many()
		.required();

	if (IS_GENERIC_COLLECTION) {
		rolesField.access({
			create: () => true,
			read: (user) => !!user,
			update: (user) => !!user
		});
	} else {
		rolesField.access({
			create: (user) => !!user && access.isAdmin(user),
			read: (user) => !!user && access.isAdmin(user),
			update: (user) => !!user && access.isAdmin(user)
		});
	}

	const fields = [
		usersFields.name.clone(),
		// Add email field for non api key auth type.
		...(!IS_API_AUTH ? [usersFields.email.clone()] : []),
		rolesField,
		...(normalizedAuthConfig.fields || []),
		// Add apiKeyId for api key auth type.
		...(IS_API_AUTH
			? [
					text('apiKeyId')
						.hidden()
						.access({ update: () => false })
				]
			: [])
	];

	if (IS_API_AUTH) {
		const ownerIdField = text('ownerId')
			.hidden()
			.access({ update: () => false });
		fields.push(ownerIdField);
	}

	return { ...normalizedAuthConfig, fields };
};
