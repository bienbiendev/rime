import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import { error, json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/** `PATCH /api/<collection>/<id>/slug` with `{ slug }`: the page's address in the request's locale. */
export const restUpdateSlugById = endpoint(async ({ event, collection }) => {
  if (!event.params.id) throw error(404);

  const [readError, body] = await trycatch(() => event.request.json());
  if (readError || typeof body?.slug !== 'string') throw error(400, 'a slug is expected');

  const [updateError, row] = await trycatch(() =>
    collection.updateSlugById({
      id: event.params.id!,
      slug: body.slug,
      locale: event.locals.rime.getLocale()
    })
  );
  if (updateError) return handleError(updateError, { context: ERROR_CONTEXT.API });

  return json({ slug: row.slug, path: row.path, url: row.url });
});
