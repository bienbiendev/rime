import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { trycatch } from '$lib/util/function.js';
import { error, json, type RequestEvent } from '@sveltejs/kit';

export async function restDuplicate(event: RequestEvent) {
  //
  const { rime } = event.locals;
  const slug = event.params.slug;

  if (!rime.config.isCollection(slug)) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
  }

  const collection = rime.collection(slug);
  if (!event.params.id) throw error(404);

  const [duplicateError, newId] = await trycatch(() =>
    collection.duplicate({ id: event.params.id! })
  );

  if (duplicateError) {
    return handleError(duplicateError, { context: ERROR_CONTEXT.API });
  }

  return json({ id: newId });
}
