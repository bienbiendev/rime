import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { FieldsPreviewProps } from '#lib/fields/types.js';
import SheetIcon from '@lucide/svelte/icons/sheet';
import type { Component } from 'svelte';
import type { RichTextFeature, RichTextFeatureNode } from '../../../../../types.js';
import { FieldsExtension } from './extension.js';

export interface FieldsFeatureOptions {
  name: string;
  label?: string;
  fields: FieldBuilder[];
  preview?: Component<FieldsPreviewProps>;
}

const fieldsFeatureNode = (args: FieldsFeatureOptions): RichTextFeatureNode => ({
  label: args.label || args.name,
  icon: SheetIcon,
  isActive: ({ editor }) => editor.isActive('rich-text-fields-' + args.name),
  suggestion: {
    // This feature's own node: each `fields()` is a node type of its own
    command: ({ editor }) =>
      editor
        .chain()
        .focus()
        .insertContent({ type: 'rich-text-fields-' + args.name })
        .run()
  }
});

export const FieldsFeature = (args: FieldsFeatureOptions): RichTextFeature => ({
  extension: FieldsExtension.configure({ fields: args.fields, preview: args.preview }).extend({
    name: 'rich-text-fields-' + args.name
  }),
  nodes: [fieldsFeatureNode(args)]
});
