import { tab, tabs, tree, text, link } from '$lib/fields/index.js';
import { access } from '$lib/util/access/index.js';
import { Area } from '$rime/config';
import { Menu } from '@lucide/svelte';

const Link = [
	text('label').layout('compact'),
	link('link').types('pages', 'url').layout('compact')
];

export const Navigation = Area.create('navigation', {
	icon: Menu,
	panel: {
		group: 'global',
		description: 'Define your website navigation'
	},
	fields: [
		//
		tabs(
			tab('header').fields(
				tree('mainNav')
					.fields(...Link)
					.renderTitle(({ values }) => values.label || 'Lien')
					.label('Menu principal')
					.addItemLabel('Ajouter un lien')
			),
			tab('footer').fields(tree('footerNav').fields(...Link))
		)
	],
	access: {
		read: (user) => access.hasRoles(user, 'admin')
	}
});
