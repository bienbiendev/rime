import type { Dic } from '$lib/util/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import ResourceComponent from './resource.svelte';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resource: {
      insertResource: (attributes: Dic) => ReturnType;
    };
  }
}

export const Resource = Node.create({
  name: 'resource',
  group: 'block',
  atom: true,
  draggable: true, // Optional: to make the node draggable
  inline: false,

  addOptions() {
    return {
      query: null,
      _type: null
    };
  },

  addAttributes() {
    return ['id', 'title', '_type', '_thumbnail'].reduce((acc: Dic, key) => {
      acc[key] = { default: null };
      return acc;
    }, {});
  },

  addCommands() {
    return {
      insertResource:
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
    return [{ tag: 'richt-text-resource' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['richt-text-resource', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(ResourceComponent);
  }
});
