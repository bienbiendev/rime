import type { PrototypeSlug } from '#lib/core/prototype/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import ResourceComponent from './resource.svelte';

export interface ResourceFeatureExtensionOptions {
  label?: string;
  /** The collection slug, with an optional query that filters the picker: `<slug>?<query>`. */
  source: `${PrototypeSlug}${string}`;
}

export const Resource = Node.create<ResourceFeatureExtensionOptions>({
  name: 'resource',
  group: 'block',
  atom: true,
  draggable: true,
  inline: false,

  addAttributes() {
    return {
      // A node just inserted opens its dialog; one read from stored content does not.
      _fresh: { default: false },
      id: { default: null },
      title: { default: null },
      _type: { default: null },
      _thumbnail: { default: null }
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
