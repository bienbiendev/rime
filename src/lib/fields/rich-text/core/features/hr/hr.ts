import SeparatorHorizontal from '@lucide/svelte/icons/separator-horizontal';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import type { RichTextFeature, RichTextFeatureMark } from '../../types.js';
import './hr.css';

const hrItem: RichTextFeatureMark = {
  label: 'Horizontal Rule',
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
