import { toggle, relation } from '$lib/fields/index.js';
import { access } from '$lib/util/access/index.js';
import { Area } from '$rime/config';
import { Settings2 } from '@lucide/svelte';

export const Settings = Area.create('settings', {
	icon: Settings2,
	panel: {
		group: 'system',
		description: 'System settings, maintenance and more'
	},
	fields: [toggle('maintenance').label('Maintenance').required(), relation('logo').to('medias')],
	access: {
		read: (user) => access.hasRoles(user, 'admin')
	}
});
