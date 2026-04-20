import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { FieldsPreviewProps } from '$lib/fields/types.js';
import { Sheet as SheetIcon } from '@lucide/svelte';
import type { Component } from 'svelte';
import type { RichTextFeature, RichTextFeatureNode } from '../../../../../types.js';
import { FieldsExtension } from './extension.js';

export interface FieldsFeatureOptions {
  name: string;
  label: string;
  fields: FieldBuilder[];
  preview?: Component<FieldsPreviewProps>;
}

const fieldsFeatureNode = (args: FieldsFeatureOptions): RichTextFeatureNode => ({
  label: args.label || args.name,
  icon: SheetIcon,
  isActive: ({ editor }) => editor.isActive('richt-text-fields'),
  suggestion: {
    command: ({ editor }) => editor.chain().focus().insertSheet().run()
  }
});

export const FieldsFeature = (args: FieldsFeatureOptions): RichTextFeature => ({
  extension: FieldsExtension.configure({ fields: args.fields, preview: args.preview }),
  nodes: [fieldsFeatureNode(args)]
});
