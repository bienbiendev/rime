import type { FieldBuilder } from '#lib/core/fields/builders/index.js';
import type { FieldsPreviewProps } from '#lib/fields/types.js';
import { Node, mergeAttributes } from '@tiptap/core';
import type { Component } from 'svelte';
import SvelteNodeViewRenderer from '../../svelte/node-view-renderer.svelte';
import { jsonAttribute } from '../json-attribute.js';
import FieldsComponent from './fields.svelte';

export interface FieldsFeatureExtensionOptions {
  fields: FieldBuilder[];
  preview?: Component<FieldsPreviewProps>;
}

export const FieldsExtension = Node.create<FieldsFeatureExtensionOptions>({
  name: 'rich-text-fields',
  group: 'block',
  atom: true,
  draggable: true,
  inline: false,

  addAttributes() {
    return { json: jsonAttribute('json') };
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
