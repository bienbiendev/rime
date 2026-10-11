import Images from '@lucide/svelte/icons/images';
import type { RichTextFeature } from '../../types.js';
import { Upload, type UploadFeatureExtensionOptions } from './upload-extension.js';

export const UploadFeature = (args: UploadFeatureExtensionOptions): RichTextFeature => {
  const slug = args.source.split('?')[0];
  return {
    extension: Upload.configure(args).extend({ name: 'rich-text-upload-' + slug }),
    nodes: [
      {
        label: 'Media',
        icon: Images,
        isActive: ({ editor }) => editor.isActive('rich-text-upload-' + slug),
        suggestion: {
          // This feature's own node: each `upload()` is a node type of its own
          command: ({ editor }) =>
            editor
              .chain()
              .focus()
              .insertContent({ type: 'rich-text-upload-' + slug, attrs: { _fresh: true } })
              .run()
        }
      }
    ]
  };
};
