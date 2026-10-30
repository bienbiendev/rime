import { t__ } from '#lib/core/i18n/index.js';
import SeparatorHorizontal from '@lucide/svelte/icons/separator-horizontal';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import type { RichTextFeature, RichTextFeatureNode } from '../../types.js';
import './hr.css';

const hrItem: RichTextFeatureNode = {
  // Read on each use: the panel loads its dictionaries after this module runs
  get label() {
    return t__('fields.rich_text_horizontal_rule');
  },
  icon: SeparatorHorizontal,
  isActive: () => false,
  suggestion: {
    command: ({ editor }) => editor.chain().focus().setHorizontalRule().run()
  }
};

export const HorizontalRuleFeature: RichTextFeature = {
  // No extension on the server, where the editor never runs.
  extension: !import.meta.env.SSR ? HorizontalRule : undefined,
  nodes: [hrItem]
};
