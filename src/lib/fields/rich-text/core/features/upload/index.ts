import type { CollectionSlug } from '$lib/types.js';
import { Images } from '@lucide/svelte';
import type { RichTextFeature, RichTextFeatureNode } from '../../types.js';
import { Upload } from './upload-extension.js';

const uploadFeatureNode: RichTextFeatureNode = {
  label: 'Media',
  icon: Images,
  isActive: ({ editor }) => editor.isActive('richt-text-media'),
  suggestion: {
    //@ts-expect-error insertMedia is defined by the extension
    command: ({ editor }) => editor.chain().focus().insertMedia().run()
  }
};

export const UploadFeature = (args: { slug: CollectionSlug; query?: string }): RichTextFeature => ({
  extension: Upload.configure(args),
  nodes: [uploadFeatureNode]
});
