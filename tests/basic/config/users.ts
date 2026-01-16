import { text } from '$lib/fields/index.js';
import { access } from '$lib/util/access';
import { Collection } from '$rime/config';

export const Users = Collection.create('users', {
	auth: {
		type: 'password',
		roles: ['user']
	},
	fields: [text('website')],
	access: {
		create: () => true,
		read: () => true,
		update: (user, { id }) => access.isAdminOrMe(user, id),
		delete: (user, { id }) => access.isAdminOrMe(user, id)
	}
});
