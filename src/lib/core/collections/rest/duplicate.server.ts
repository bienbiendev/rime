import { handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { error, json, type RequestEvent } from '@sveltejs/kit';

export async function restDuplicate(event: RequestEvent) {
  //
  const { rime } = event.locals;
  const slug = event.params.slug;

  if (!rime.config.isCollection(slug)) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: 'api' });
  }

  const collection = rime.collection(slug);
  if (!event.params.id) throw error(404);

  const newId = await collection.duplicate({ id: event.params.id });

  return json({ id: newId });
}
