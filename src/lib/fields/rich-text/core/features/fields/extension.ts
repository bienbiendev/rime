import type { Dic } from '$lib/util/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import FieldsComponent from './fields.svelte';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sheet: {
      insertSheet: (attributes: Dic) => ReturnType;
    };
  }
}

export const FieldsExtension = Node.create({
  name: 'richt-text-fields',
  group: 'block',
  atom: true,
  draggable: true, // Optional: to make the node draggable
  inline: false,

  addOptions() {
    return {
      fields: null
    };
  },

  addAttributes() {
    return ['json'].reduce((acc: Dic, key) => {
      acc[key] = { default: null };
      return acc;
    }, {});
  },

  addCommands() {
    return {
      insertSheet:
        (attributes = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes
          });
        }
    };
  },

  parseHTML() {
    return [{ tag: 'richt-text-fields' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['richt-text-fields', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(FieldsComponent);
  }
});
