import { error, type ServerLoadEvent } from '@sveltejs/kit';

/** The page whose `attributes.slug` is the URL segment, or the `isHome` page at `/`. */
export const load = async (event: ServerLoadEvent) => {
  const { rime } = event.locals;
  const { id } = event.params;

  const query = id
    ? { where: { 'attributes.slug': { equals: id } } }
    : { where: { 'attributes.isHome': { equals: true } } };
  const docs = await rime.collection('pages').find({ query, depth: 2 });
  if (!docs.length) {
    throw error(404, 'Not found');
  }

  return { doc: docs[0] };
};
