import type { CollectionWithoutSlug } from '$lib/core/collections/config/types.js';
import type { Field, Option } from '$lib/types.js';
import { access } from '$lib/util/index.js';
import { UsersRound } from '@lucide/svelte';
import cloneDeep from 'clone-deep';

import type { Access, AdditionalStaffConfig, Collection, CollectionAuthConfig } from '../types.js';
import type { WithRequired } from '$lib/util/types.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';

export const staffCollection = {
	label: { singular: 'User', plural: 'Users' },
	panel: {
		description: 'Manage who can access your admin panel',
		group: 'system'
	},
	auth: {
		type: 'password',
		roles: ['admin', 'staff']
	},
	icon: UsersRound,
	fields: [] as FieldBuilder<Field>[],
	access: {
		read: (user) => access.isAdmin(user),
		create: (user) => access.isAdmin(user),
		delete: (user) => access.isAdmin(user),
		update: (user, { id }) => access.isAdminOrMe(user, id)
	} as Access
};

export const getStaffCollection = ({
	roles: incomingRoles = [],
	fields = [],
	access,
	panel,
	label
}: AdditionalStaffConfig = {}) => {
	const staffConfig = cloneDeep(staffCollection) as typeof staffCollection;
	let roles: Option[] = incomingRoles.map((role) =>
		typeof role === 'string' ? { value: role } : role
	);

	if (roles) {
		const hasAdminRole = roles.find((role) => role.value === 'admin');
		const otherRoles = roles.filter((role) => role.value !== 'admin');

		// Add admin role on Staff collection if not present
		if (!hasAdminRole) {
			roles = [{ value: 'admin' }, ...roles];
		}

		// If there is no other roles than admin add a staff role
		if (otherRoles.length === 0) {
			roles.push({ value: 'staff' });
		}

		staffConfig.auth.roles = roles.map((role) => role.value);
	}

	if (fields) {
		staffConfig.fields.push(...fields);
	}
	if (access) {
		staffConfig.access = {
			...staffConfig.access,
			...access
		};
	}
	if (panel?.group) {
		staffConfig.panel = { ...staffConfig.panel, group: panel?.group };
	}
	if (label) {
		staffConfig.label = label;
	}

	return staffConfig as CollectionWithoutSlug<'staff'>;
};
