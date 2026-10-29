import { checkLiveRedirect } from '#lib/panel/util/live.server.js';
import { error, type ServerLoadEvent } from '@sveltejs/kit';

/**
 * The news whose `attributes.slug` is the segment, under `/news` (the `news` matcher). A signed-in
 * visitor reads the newest version; staff asking `?live=1` go to the live editor.
 */
export const load = async (event: ServerLoadEvent) => {
  const { rime, user } = event.locals;
  const { parentSlug, slug } = event.params;

  const locale = parentSlug === 'news' ? 'en' : 'fr';

  const query = `where[attributes.slug][equals]=${slug}`;
  const docs = await rime.collection('news').find({ query, locale, depth: 2, latest: !!user });

  if (!docs.length) {
    throw error(404, 'Not found');
  }

  checkLiveRedirect(docs[0], event);

  return { doc: docs[0] };
};
