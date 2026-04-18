import type { Dic } from '$lib/util/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import CounterComponent from './upload.svelte';

export const Upload = Node.create({
  name: 'upload',
  group: 'block',
  atom: true,
  draggable: true, // Optional: to make the node draggable
  inline: false,

  addOptions() {
    return {
      query: null
    };
  },

  addAttributes() {
    return ['id', 'title', 'sizes', 'mimeType', 'url', 'filename', 'legend'].reduce(
      (acc: Dic, key) => {
        acc[key] = { default: null };
        return acc;
      },
      {}
    );
  },

  //@ts-expect-error annoying
  addCommands() {
    return {
      insertMedia:
        (attributes = {}) =>
        //@ts-expect-error annoying
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes
          });
        }
    };
  },

  parseHTML() {
    return [{ tag: 'richt-text-media' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['richt-text-media', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(CounterComponent);
  }
});
