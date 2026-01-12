import type { PrototypeSlug } from '$lib/types.js';
import { LinkIcon } from '@lucide/svelte';
import Link, { type LinkOptions } from '@tiptap/extension-link';
import type { RichTextFeature, RichTextFeatureMark } from '../../types.js';
import LinkSelector from './component/link-selector.svelte';

// Create the link extension
const linkExtension = import.meta.env.SSR
	? undefined
	: Link.extend({
			// @ts-expect-error @tiptap error
			addOptions() {
				return {
					...this.parent?.(),
					types: []
				};
			},
			openOnClick: false,
			HTMLAttributes: { class: 'rz-rich-text-link' }
		});

// Create link feature item
const linkItem: RichTextFeatureMark = {
	label: 'Link',
	icon: LinkIcon,
	isActive: ({ editor }) => editor.isActive('link'),
	bubbleMenu: {
		component: LinkSelector
	}
};

export type LinkFeatureOptions = LinkOptions & {
	resources?: Array<{ slug: PrototypeSlug; query?: string }>;
};
export const LinkFeature = (options?: Partial<LinkFeatureOptions>): RichTextFeature => ({
	extension: linkExtension
		? linkExtension.configure({
				openOnClick: false,
				autolink: false,
				protocols: ['mailto', 'tel', 'http', 'https'],
				...options
			})
		: undefined,
	marks: [linkItem]
});
