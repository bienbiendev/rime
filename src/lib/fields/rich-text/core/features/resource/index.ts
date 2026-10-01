import { Images } from '@lucide/svelte';
import type { RichTextFeature } from '../../types.js';
import { Resource, type ResourceFeatureExtensionOptions } from './resource-extension.js';

export const ResourceFeature = (args: ResourceFeatureExtensionOptions): RichTextFeature => {
  const slug = args.source.split('?')[0];
  return {
    extension: Resource.configure(args).extend({
      name: 'rich-text-resource-' + slug
    }),
    nodes: [
      {
        label: args.label || slug,
        icon: Images,
        isActive: ({ editor }) => editor.isActive('rich-text-resource-' + slug),
        suggestion: {
          // This feature's own node: each `resource()` is a node type of its own.
          command: ({ editor }) =>
            editor
              .chain()
              .focus()
              .insertContent({ type: 'rich-text-resource-' + slug, attrs: { _fresh: true } })
              .run()
        }
      }
    ]
  };
};
