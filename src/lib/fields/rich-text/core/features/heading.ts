// /Users/ai/Dev/rime/src/lib/fields/rich-text/core/features/heading.ts
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon
} from '@lucide/svelte';
import type { Editor, Range } from '@tiptap/core';
import Heading, { type Level } from '@tiptap/extension-heading';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

// Create the heading extension
const headingExtension = (levels?: Level[]) =>
  Heading.configure({
    levels: levels || [1, 2, 3, 4, 5, 6],
    HTMLAttributes: { class: 'rz-rich-text-heading' }
  });

function toggleOrCreate(level: Level, { editor, range }: { editor: Editor; range?: Range }) {
  if (!range || range.from === range.to) {
    return editor.chain().focus().createParagraphNear().setHeading({ level }).run();
  }
  editor.chain().focus().toggleHeading({ level }).run();
}

// Create heading feature items for each level
const headingItems: RichTextFeatureNode[] = [
  {
    label: 'Heading 1',
    icon: Heading1Icon,
    isActive: ({ editor }) => editor.isActive('heading', { level: 1 }),
    nodeSelector: {
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 1 }).run()
    },
    suggestion: {
      command: ({ editor, range }) => toggleOrCreate(1, { range, editor })
    }
  },
  {
    label: 'Heading 2',
    icon: Heading2Icon,
    isActive: ({ editor }) => editor.isActive('heading', { level: 2 }),
    nodeSelector: {
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
    suggestion: {
      command: ({ editor, range }) => toggleOrCreate(2, { range, editor })
    }
  },
  {
    label: 'Heading 3',
    icon: Heading3Icon,
    isActive: ({ editor }) => editor.isActive('heading', { level: 3 }),
    nodeSelector: {
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 3 }).run()
    },
    suggestion: {
      command: ({ editor, range }) => toggleOrCreate(3, { range, editor })
    }
  },
  {
    label: 'Heading 4',
    icon: Heading4Icon,
    isActive: ({ editor }) => editor.isActive('heading', { level: 4 }),
    nodeSelector: {
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 4 }).run()
    },
    suggestion: {
      command: ({ editor, range }) => toggleOrCreate(4, { range, editor })
    }
  },
  {
    label: 'Heading 5',
    icon: Heading5Icon,
    isActive: ({ editor }) => editor.isActive('heading', { level: 5 }),
    nodeSelector: {
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 5 }).run()
    },
    suggestion: {
      command: ({ editor, range }) => toggleOrCreate(5, { range, editor })
    }
  },
  {
    label: 'Heading 6',
    icon: Heading6Icon,
    isActive: ({ editor }) => editor.isActive('heading', { level: 6 }),
    nodeSelector: {
      command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 6 }).run()
    },
    suggestion: {
      command: ({ editor, range }) => toggleOrCreate(6, { range, editor })
    }
  }
];

// Export the heading feature with all levels
export const HeadingFeature = (...levels: Level[]): RichTextFeature => ({
  extension: headingExtension(levels),
  nodes: levels.map((number) => headingItems[number - 1])
});
