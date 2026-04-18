import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { Sheet as SheetIcon } from '@lucide/svelte';
import type { RichTextFeature, RichTextFeatureNode } from '../../../../../types.js';
import { FieldsExtension } from './extension.js';

type Args = { name: string; label: string; fields: FieldBuilder[] };

const fieldsFeatureNode = (args: Args): RichTextFeatureNode => ({
  label: args.label || args.name,
  icon: SheetIcon,
  isActive: ({ editor }) => editor.isActive('richt-text-fields'),
  suggestion: {
    //@ts-expect-error annoying
    command: ({ editor }) => editor.chain().focus().insertSheet().run()
  }
});

export const FieldsFeature = (args: Args): RichTextFeature => ({
  extension: FieldsExtension.configure(args),
  nodes: [fieldsFeatureNode(args)]
});
