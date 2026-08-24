import { text } from '$lib/fields/index.js';
import { Collection } from '$rime/config';

export const Targets = Collection.create('targets', {
  fields: [text('title').isTitle()]
});
