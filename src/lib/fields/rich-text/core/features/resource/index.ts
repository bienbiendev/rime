import { Images } from '@lucide/svelte';
import type { RichTextFeature } from '../../types.js';
import { Resource, type ResourceFeatureExtensionOptions } from './resource-extension.js';

export const ResourceFeature = (args: ResourceFeatureExtensionOptions): RichTextFeature => {
  const slug = args.source.split('?')[0];
  return {
    extension: Resource.configure(args).extend({
      name: 'richt-text-resource-' + slug
    }),
    nodes: [
      {
        label: args.label || slug,
        icon: Images,
        isActive: ({ editor }) => editor.isActive('richt-text-resource-' + slug),
        suggestion: {
          command: ({ editor }) => editor.chain().focus().insertResource().run()
        }
      }
    ]
  };
};
