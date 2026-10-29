import Heading1Icon from '@lucide/svelte/icons/heading-1';
import Heading2Icon from '@lucide/svelte/icons/heading-2';
import Heading3Icon from '@lucide/svelte/icons/heading-3';
import Heading4Icon from '@lucide/svelte/icons/heading-4';
import Heading5Icon from '@lucide/svelte/icons/heading-5';
import Heading6Icon from '@lucide/svelte/icons/heading-6';
import type { Editor, Range } from '@tiptap/core';
import Heading, { type Level } from '@tiptap/extension-heading';
import type { RichTextFeature, RichTextFeatureNode } from '../types.js';

const ALL_LEVELS: Level[] = [1, 2, 3, 4, 5, 6];

/** The tiptap heading extension, offering the levels given. */
const headingExtension = (levels: Level[]) =>
  Heading.configure({
    levels,
    HTMLAttributes: { class: 'rz-rich-text-heading' }
  });

/**
 * The palette's heading command. On a caret it turns the current block into a heading, or adds
 * one at a gap cursor; over a selection it toggles the heading.
 */
function toggleOrCreate(level: Level, { editor, range }: { editor: Editor; range?: Range }) {
  if (!range || range.from === range.to) {
    return editor.chain().focus().createParagraphNear().setHeading({ level }).run();
  }
  editor.chain().focus().toggleHeading({ level }).run();
}

const ICONS = [Heading1Icon, Heading2Icon, Heading3Icon, Heading4Icon, Heading5Icon, Heading6Icon];

// The node-selector and palette entries of one heading level
const headingItem = (level: Level): RichTextFeatureNode => ({
  label: `Heading ${level}`,
  icon: ICONS[level - 1],
  isActive: ({ editor }) => editor.isActive('heading', { level }),
  nodeSelector: {
    command: ({ editor }) => editor.chain().focus().toggleHeading({ level }).run()
  },
  suggestion: { command: (args) => toggleOrCreate(level, args) }
});

/** The heading feature with the levels given, or all six when none is given. */
export const HeadingFeature = (...levels: Level[]): RichTextFeature => {
  const used = levels.length ? levels : ALL_LEVELS;
  return {
    extension: headingExtension(used),
    nodes: used.map(headingItem)
  };
};
