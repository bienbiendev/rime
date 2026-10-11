import { requestData } from '#lib/core/prototype/shared/rest/params.server.js';
import { error } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * `PATCH /api/<collection>/<id>/slug` with `{ slug }`: the page's address in the request's locale,
 * which `?locale=` names. A body `locale` answers 400.
 */
export const restUpdateSlugById = endpoint(async ({ event, collection }) => {
  if (!event.params.id) throw error(404);

  const body = await requestData(event);
  if (typeof body.slug !== 'string') throw error(400, 'a slug is expected');

  const row = await collection.updateSlugById({ id: event.params.id, slug: body.slug });

  return Response.json({ slug: row.slug, path: row.path, url: row.url });
});
