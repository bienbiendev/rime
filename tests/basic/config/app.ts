import access from '$lib/util/access';
import { Collection } from '$rime/config';

export const Apps = Collection.create('apps', {
	auth: {
		type: 'apiKey',
		roles: ['apps']
	},
	fields: [],
	access: {
		create: (user) => access.isAdmin(user),
		read: (user) => access.isAdmin(user),
		update: (user) => access.isAdmin(user),
		delete: (user) => access.isAdmin(user)
	}
});
