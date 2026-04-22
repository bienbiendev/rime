import type { CollectionSlug } from '$lib/types';
import type { Dic } from '$lib/util/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import CounterComponent from './upload.svelte';

export interface UploadFeatureExtensionOptions {
  query?: string;
  slug: CollectionSlug;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    upload: {
      insertUpload: (attributes?: Dic) => ReturnType;
    };
  }
}

export const Upload = Node.create<UploadFeatureExtensionOptions>({
  name: 'upload',
  group: 'block',
  atom: true,
  draggable: true,
  inline: false,

  addAttributes() {
    return ['id', 'title', 'sizes', 'mimeType', 'url', 'filename', 'legend'].reduce(
      (acc: Dic, key) => {
        acc[key] = { default: null };
        return acc;
      },
      // We use this attribute to determine if the resource is fresh or not.
      // If it's fresh, we want to open the dialog
      { _fresh: { default: true } }
    );
  },

  addCommands() {
    return {
      insertUpload:
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
    return [{ tag: 'richt-text-media' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['richt-text-media', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(CounterComponent);
  }
});
