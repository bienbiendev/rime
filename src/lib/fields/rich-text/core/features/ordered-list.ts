import { ListOrdered } from '@lucide/svelte';
import { OrderedList } from '@tiptap/extension-list';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

const orderedListFeatureNode: RichTextFeatureNode = {
  label: 'Ordered list',
  icon: ListOrdered,
  isActive: ({ editor }) => editor.isActive('orderedList'),
  bubbleMenu: {
    command: ({ editor }) => editor.chain().focus().toggleOrderedList().run()
  },
  suggestion: {
    command: ({ editor }) => editor.chain().focus().toggleOrderedList().run()
  }
};

export const OrderedListFeature: RichTextFeature = {
  extension: OrderedList,
  nodes: [orderedListFeatureNode]
};
