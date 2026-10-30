import { t__ } from '#lib/core/i18n/index.js';
import List from '@lucide/svelte/icons/list';
import { BulletList } from '@tiptap/extension-list';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

const bulletListFeatureNode: RichTextFeatureNode = {
  // Read on each use: the panel loads its dictionaries after this module runs
  get label() {
    return t__('fields.rich_text_bullet_list');
  },
  icon: List,
  isActive: ({ editor }) => editor.isActive('bulletList'),
  bubbleMenu: {
    command: ({ editor }) => editor.chain().focus().toggleBulletList().run()
  },
  suggestion: {
    command: ({ editor }) => editor.chain().focus().toggleBulletList().run()
  }
};

export const BulletListFeature: RichTextFeature = {
  extension: BulletList,
  nodes: [bulletListFeatureNode]
};
