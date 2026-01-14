import { Text } from '@lucide/svelte';
import Paragraph from '@tiptap/extension-paragraph';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

const paragraphFeatureNode: RichTextFeatureNode = {
	label: 'Paragraph',
	icon: Text,
	isActive: ({ editor }) => editor.isActive('paragraph'),
	nodeSelector: {
		command: ({ editor }) => editor.chain().focus().setNode('paragraph').run()
	}
};

export const ParagraphFeature: RichTextFeature = {
	extension: Paragraph.configure(),
	nodes: [paragraphFeatureNode]
};
