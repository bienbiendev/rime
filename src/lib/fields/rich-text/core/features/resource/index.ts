import type { PrototypeSlug } from '$lib/types.js';
import { Images } from '@lucide/svelte';
import type { RichTextFeature, RichTextFeatureNode } from '../../types.js';
import { Resource } from './resource-extension.js';

const resourceFeatureNode: RichTextFeatureNode = {
	label: 'Resource',
	icon: Images,
	isActive: ({ editor }) => editor.isActive('richt-text-resource'),
	suggestion: {
		//@ts-expect-error annoying
		command: ({ editor }) => editor.chain().focus().insertResource().run()
	}
};

export const ResourceFeature = (args: {
	query?: string;
	slug: PrototypeSlug;
}): RichTextFeature => ({
	extension: Resource.configure(args),
	nodes: [resourceFeatureNode]
});
