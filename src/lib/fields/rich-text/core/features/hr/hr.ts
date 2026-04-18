import { SeparatorHorizontal } from '@lucide/svelte';
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
  extension: !import.meta.env.SSR ? HorizontalRule : undefined,
  nodes: [hrItem]
};
