import { checkLiveRedirect } from '#lib/panel/util/live.server.js';
import { error, type ServerLoadEvent } from '@sveltejs/kit';

/**
 * Serves the news whose slug is the last segment of `/news/<slug>`. Staff asking `?live=1` go to
 * the live editor.
 */
export const load = async (event: ServerLoadEvent) => {
  const { rime } = event.locals;
  const { slug } = event.params;

  const query = `where[attributes.slug][equals]=${encodeURIComponent(slug ?? '')}`;
  const docs = await rime.collection('news').find({ query, depth: 2 });

  if (!docs.length) {
    throw error(404, 'Not found');
  }

  checkLiveRedirect(docs[0], event);

  return { doc: docs[0] };
};
