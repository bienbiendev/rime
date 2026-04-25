import { Images } from '@lucide/svelte';
import type { RichTextFeature } from '../../types.js';
import { Upload, type UploadFeatureExtensionOptions } from './upload-extension.js';

export const UploadFeature = (args: UploadFeatureExtensionOptions): RichTextFeature => ({
  extension: Upload.configure(args).extend({ name: 'richt-text-upload-' + args.source }),
  nodes: [
    {
      label: 'Media',
      icon: Images,
      isActive: ({ editor }) => editor.isActive('richt-text-upload-' + args.source),
      suggestion: {
        command: ({ editor }) => editor.chain().focus().insertUpload().run()
      }
    }
  ]
});
