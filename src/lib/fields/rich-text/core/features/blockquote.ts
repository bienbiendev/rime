import { t__ } from '#lib/core/i18n/index.js';
import TextQuote from '@lucide/svelte/icons/text-quote';
import Blockquote from '@tiptap/extension-blockquote';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

const blockquoteFeatureNode: RichTextFeatureNode = {
  // Read on each use: the panel loads its dictionaries after this module runs
  get label() {
    return t__('fields.rich_text_blockquote');
  },
  icon: TextQuote,
  isActive: ({ editor }) => editor.isActive('blockquote'),
  nodeSelector: {
    command: ({ editor }) => editor.chain().focus().toggleBlockquote().run()
  },
  suggestion: {
    command: ({ editor }) => editor.chain().focus().toggleBlockquote().run()
  }
};

export const BlockquoteFeature: RichTextFeature = {
  extension: Blockquote,
  nodes: [blockquoteFeatureNode]
};
