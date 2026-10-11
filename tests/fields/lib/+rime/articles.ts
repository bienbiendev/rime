import { email, relation, slug, text } from '#lib/fields/index.js';
import { Collection } from '$rime/config';

// What a copy changes: a unique title and slug numbered until free, a unique email emptied by an
// app hook, a value set by one, and a resolved reference kept as its id.
export const Articles = Collection.create('articles', {
  fields: [
    text('title').isTitle().unique().required(),
    slug('slug').slugify('title').unique(),
    email('contact')
      .unique()
      .$beforeDuplicate(() => null),
    text('code').$beforeDuplicate(() => 'NEW'),
    text('owner').$references('staff', { resolve: true }),
    // A relation to its own collection: a chain of articles, read at a depth
    relation('related').to('articles')
  ]
});
