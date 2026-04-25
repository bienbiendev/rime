import { Images } from '@lucide/svelte';
import type { RichTextFeature } from '../../types.js';
import { Upload, type UploadFeatureExtensionOptions } from './upload-extension.js';

export const UploadFeature = (args: UploadFeatureExtensionOptions): RichTextFeature => {
  const slug = args.source.split('?')[0];
  return {
    extension: Upload.configure(args).extend({ name: 'richt-text-upload-' + slug }),
    nodes: [
      {
        label: 'Media',
        icon: Images,
        isActive: ({ editor }) => editor.isActive('richt-text-upload-' + slug),
        suggestion: {
          command: ({ editor }) => editor.chain().focus().insertUpload().run()
        }
      }
    ]
  };
};
