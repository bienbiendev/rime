import BoldIcon from '@lucide/svelte/icons/bold';
import Bold from '@tiptap/extension-bold';
import type { RichTextFeature, RichTextFeatureMark } from '../types.js';

const boldExtension = Bold.configure({
  HTMLAttributes: { class: 'rz-rich-text-bold' }
});

const boldItem: RichTextFeatureMark = {
  label: 'Bold',
  icon: BoldIcon,
  isActive: ({ editor }) => editor.isActive('bold'),
  bubbleMenu: {
    command: ({ editor }) => editor.chain().focus().toggleBold().run()
  }
};

export const BoldFeature: RichTextFeature = {
  extension: boldExtension,
  marks: [boldItem]
};
