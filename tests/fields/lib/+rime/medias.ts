import { text } from '$lib/fields/index.js';
import { Collection } from '$rime/config';

/** An upload collection, for the relation picker and the inline relation of block renders. */
export const Medias = Collection.create('medias', {
  label: { singular: 'Media', plural: 'Medias' },
  upload: {
    imageSizes: [{ name: 'md', width: 1024, out: ['webp'] }]
  },
  fields: [text('alt')],
  access: {
    read: () => true
  }
});
