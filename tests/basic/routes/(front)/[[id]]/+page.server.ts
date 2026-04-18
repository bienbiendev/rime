import { error, redirect, type ServerLoadEvent } from '@sveltejs/kit';

export const load = async (event: ServerLoadEvent) => {
  const { rime, user } = event.locals;
  let { id } = event.params;

  const query = id
    ? `where[attributes.slug][equals]=${id}`
    : `where[attributes.isHome][equals]=true`;
  const docs = await rime.collection('pages').find({ query, depth: 2 });
  if (!docs.length) {
    throw error(404, 'Not found');
  }

  if (user && docs[0]._live && event.url.searchParams.get('live') === '1') {
    return redirect(302, docs[0]._live);
  }

  return { doc: docs[0] };
};
