import { t__ } from '#lib/core/i18n/index.js';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import { OrderedList } from '@tiptap/extension-list';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

const orderedListFeatureNode: RichTextFeatureNode = {
  // Read on each use: the panel loads its dictionaries after this module runs
  get label() {
    return t__('fields.rich_text_ordered_list');
  },
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
