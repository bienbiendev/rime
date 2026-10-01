import type { PrototypeSlug } from '$lib/core/prototype/types.js';
import type { Dic } from '$lib/util/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import ResourceComponent from './resource.svelte';

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
      // A node just inserted opens its dialog; one read from stored content does not.
      { _fresh: { default: false } }
    );
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
