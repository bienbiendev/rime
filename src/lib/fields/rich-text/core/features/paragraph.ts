import { t__ } from '#lib/core/i18n/index.js';
import Text from '@lucide/svelte/icons/text';
import Paragraph from '@tiptap/extension-paragraph';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

const paragraphFeatureNode: RichTextFeatureNode = {
  // Read on each use: the panel loads its dictionaries after this module runs
  get label() {
    return t__('fields.rich_text_paragraph');
  },
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
