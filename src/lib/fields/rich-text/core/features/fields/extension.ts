import type { FieldBuilder } from '$lib/core/fields/builders';
import type { FieldsPreviewProps } from '$lib/fields/types';
import type { Dic } from '$lib/util/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import type { Component } from 'svelte';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import FieldsComponent from './fields.svelte';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    'richt-text-fields': {
      insertSheet: (attributes?: Dic) => ReturnType;
    };
  }
}

export interface FieldsFeatureExtensionOptions {
  fields: FieldBuilder[];
  preview?: Component<FieldsPreviewProps>;
}

export const FieldsExtension = Node.create<FieldsFeatureExtensionOptions>({
  name: 'richt-text-fields',
  group: 'block',
  atom: true,
  draggable: true,
  inline: false,

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
    return [{ tag: this.name }];
  },

  renderHTML({ HTMLAttributes }) {
    return [this.name, mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(FieldsComponent);
  }
});
