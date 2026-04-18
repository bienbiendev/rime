import { TextQuote } from '@lucide/svelte';
import Blockquote from '@tiptap/extension-blockquote';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

const blockquoteFeatureNode: RichTextFeatureNode = {
  label: 'Blockquote',
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
