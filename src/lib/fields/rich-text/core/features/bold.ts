// /Users/ai/Dev/rime/src/lib/fields/rich-text/core/features/bold.ts
import { BoldIcon } from '@lucide/svelte';
import Bold from '@tiptap/extension-bold';
import type { RichTextFeature, RichTextFeatureMark } from '../types.js';

// Create the bold extension
const boldExtension = Bold.configure({
  HTMLAttributes: { class: 'rz-rich-text-bold' }
});

// Create bold feature item
const boldItem: RichTextFeatureMark = {
  label: 'Bold',
  icon: BoldIcon,
  isActive: ({ editor }) => editor.isActive('bold'),
  bubbleMenu: {
    command: ({ editor }) => editor.chain().focus().toggleBold().run()
  }
};

// Export the bold feature
export const BoldFeature: RichTextFeature = {
  extension: boldExtension,
  marks: [boldItem]
};
