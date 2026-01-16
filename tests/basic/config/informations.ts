import { email, slug, textarea } from '$lib/fields/index.js';
import { Area } from '$rime/config';
import { Contact } from '@lucide/svelte';

export const Informations = Area.create('infos', {
	icon: Contact,
	panel: {
		group: 'global',
		description: 'Update your website information, email, name of the website,...'
	},
	fields: [
		email('email'),
		slug('instagram').placeholder('nom-du-compte'),
		textarea('address').label('Adresse')
	],
	access: {
		read: () => true
	}
});
