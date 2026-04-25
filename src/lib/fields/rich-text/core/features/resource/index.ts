import { Images } from '@lucide/svelte';
import type { RichTextFeature } from '../../types.js';
import { Resource, type ResourceFeatureExtensionOptions } from './resource-extension.js';

export const ResourceFeature = (args: ResourceFeatureExtensionOptions): RichTextFeature => ({
  extension: Resource.configure(args).extend({ name: 'richt-text-resource-' + args.source }),
  nodes: [
    {
      label: args.label || args.source,
      icon: Images,
      isActive: ({ editor }) => editor.isActive('richt-text-resource-' + args.source),
      suggestion: {
        command: ({ editor }) => editor.chain().focus().insertResource().run()
      }
    }
  ]
});
