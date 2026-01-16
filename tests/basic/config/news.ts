import { date, richText, slug, tab, tabs, text } from '$lib/fields/index.js';
import {
	bold,
	heading,
	italic,
	link as linkFeature,
	resource,
	upload
} from '$lib/fields/rich-text/client.js';
import { Collection } from '$rime/config';
import LoremFeature from './lorem-fill.js';

import { access } from '$lib/util/access/index.js';
import { NotebookText } from '@lucide/svelte';

const tabWriter = tab('writer').fields(
	richText('text').features(
		bold(),
		italic(),
		LoremFeature,
		resource({ slug: 'pages' }),
		upload({ slug: 'medias', query: 'where[mimeType][like]=image' }),
		heading(2, 3),
		linkFeature()
	)
);

const tabNewsAttributes = tab('attributes').fields(
	text('title').isTitle().localized().required(),
	slug('slug')
		.slugify('attributes.title')
		.live(false)
		.table({ position: 3, sort: true })
		.localized()
		.required(),
	richText('intro').features(bold(), linkFeature()),
	date('published')
);

export const News = Collection.create('news', {
	icon: NotebookText,
	panel: {
		description: 'Create article for your readers',
		group: 'content'
	},
	fields: [tabs(tabNewsAttributes, tabWriter)],
	live: true,
	$url: (doc) => `${process.env.PUBLIC_RIME_URL}/actualites/${doc.attributes.slug}`,
	access: {
		read: () => true,
		create: (user) => access.isAdmin(user),
		update: (user) => access.hasRoles(user, 'admin', 'editor')
	}
});
