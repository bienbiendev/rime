import type { PrototypeSlug } from '$lib/core/types/doc';
import type { Dic } from '$lib/util/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import ResourceComponent from './resource.svelte';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resource: {
      insertResource: (attributes?: Dic) => ReturnType;
    };
  }
}

export interface ResourceFeatureExtensionOptions {
  label?: string;
  source: `${PrototypeSlug}${string}`;
}

export const Resource = Node.create<ResourceFeatureExtensionOptions>({
  name: 'resource',
  group: 'block',
  atom: true,
  draggable: true,
  inline: false,

  addAttributes() {
    return ['id', 'title', '_type', '_thumbnail'].reduce(
      (acc: Dic, key) => {
        acc[key] = { default: null };
        return acc;
      },
      // Fresh attributes allowing to show the dialog immediately after insertion
      { _fresh: { default: true } }
    );
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
    return [{ tag: this.name }];
  },

  renderHTML({ HTMLAttributes }) {
    return [this.name, mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(ResourceComponent);
  }
});
