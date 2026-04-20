import { Images } from '@lucide/svelte';
import type { RichTextFeature, RichTextFeatureNode } from '../../types.js';
import { Resource, type ResourceFeatureExtensionOptions } from './resource-extension.js';

const resourceFeatureNode: RichTextFeatureNode = {
  label: 'Resource',
  icon: Images,
  isActive: ({ editor }) => editor.isActive('richt-text-resource'),
  suggestion: {
    command: ({ editor }) => editor.chain().focus().insertResource().run()
  }
};

export const ResourceFeature = (args: ResourceFeatureExtensionOptions): RichTextFeature => ({
  extension: Resource.configure(args),
  nodes: [resourceFeatureNode]
});
