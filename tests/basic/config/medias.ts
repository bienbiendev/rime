import { text } from '$lib/fields/index.js';
import { Collection } from '$rime/config';
import { Images } from '@lucide/svelte';

export const Medias = Collection.create('medias', {
	label: { singular: 'Media', plural: 'Medias' },
	panel: {
		description: 'Manage images, video, audio, documents,...',
		group: 'content'
	},
	upload: {
		imageSizes: [
			{ name: 'sm', width: 640, out: ['webp'] },
			{ name: 'md', width: 1024, out: ['webp'] },
			{ name: 'lg', width: 1536, out: ['webp'] },
			{ name: 'xl', width: 2048, out: ['webp'] }
		]
	},
	icon: Images,
	fields: [text('alt').required()],
	access: {
		read: () => true
	}
});
