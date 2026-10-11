import type { CollectionSlug } from '#lib/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import { jsonAttribute } from '../json-attribute.js';
import CounterComponent from './upload.svelte';

export interface UploadFeatureExtensionOptions {
  source: `${CollectionSlug}${string}`;
}

export const Upload = Node.create<UploadFeatureExtensionOptions>({
  name: 'upload',
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
      sizes: jsonAttribute('sizes'),
      mimeType: { default: null },
      url: { default: null },
      filename: { default: null },
      legend: { default: null }
    };
  },

  // Each upload type has its own tag: a pasted node goes back to its own type
  parseHTML() {
    return [{ tag: this.name }];
  },

  renderHTML({ HTMLAttributes }) {
    return [this.name, mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(CounterComponent);
  }
});
