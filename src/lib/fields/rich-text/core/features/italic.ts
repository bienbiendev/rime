import { ItalicIcon } from '@lucide/svelte';
import Italic from '@tiptap/extension-italic';
import type { RichTextFeature, RichTextFeatureMark } from '../types.js';

const italicItem: RichTextFeatureMark = {
  label: 'Italic',
  icon: ItalicIcon,
  isActive: ({ editor }) => editor.isActive('italic'),
  bubbleMenu: {
    command: ({ editor }) => editor.chain().focus().toggleItalic().run()
  }
};

export const ItalicFeature: RichTextFeature = {
  extension: Italic,
  marks: [italicItem]
};
