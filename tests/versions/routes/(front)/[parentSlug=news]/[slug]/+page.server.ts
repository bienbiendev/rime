import { checkLiveRedirect } from '$lib/panel/util/live.server.js';
import { error, type ServerLoadEvent } from '@sveltejs/kit';

export const load = async (event: ServerLoadEvent) => {
  const { rime, user } = event.locals;
  const { parentSlug, slug } = event.params;

  const locale = parentSlug === 'news' ? 'en' : 'fr';

  const query = `where[attributes.slug][equals]=${slug}`;
  const docs = await rime.collection('news').find({ query, locale, depth: 2, draft: !!user });

  if (!docs.length) {
    throw error(404, 'Not found');
  }

  checkLiveRedirect(docs[0], event);

  return { doc: docs[0] };
};
