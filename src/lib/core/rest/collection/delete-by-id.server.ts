import { RimeError } from '$lib/core/errors/index.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import { json, type RequestEvent } from '@sveltejs/kit';

/**
 * DELETE handler for the collection API endpoint to delete a document by its ID.
 */
export async function restDeleteById(event: RequestEvent) {
  //
  const { rime } = event.locals;

  const slug = event.params.slug;
  if (!rime.config.isCollection(slug)) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: 'api' });
  }

  const id = event.params.id || '';
  const [error] = await trycatch(() => rime.collection(slug).deleteById({ id }));

  if (error) {
    return handleError(error, { context: 'api' });
  }

  return json({ id });
}
