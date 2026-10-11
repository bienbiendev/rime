import { text } from '#lib/fields/index.js';
import { Collection } from '$rime/config';

export const Targets = Collection.create('targets', {
  fields: [text('title').isTitle()]
});

// A camelCase slug that holds `Id`: its junction column is `productIdeasId`
export const ProductIdeas = Collection.create('productIdeas', {
  fields: [text('title').isTitle()]
});
