import { PARAMS } from '$lib/core/constants.js';
import { RimeError } from '$lib/core/errors/index.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { trycatch } from '$lib/util/function.js';
import { json } from '@sveltejs/kit';
import { endpoint } from './endpoint.server.js';

/**
 * GET handler for the collection API endpoint to retrieve a document by its ID.
 */
export const restGetById = endpoint(async ({ event, collection }) => {
  //
  const { rime } = event.locals;
  const id = event.params.id;

  if (!id) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: 'api' });
  }

  const paramDepth = event.url.searchParams.get(PARAMS.DEPTH);
  const paramDraft = event.url.searchParams.get(PARAMS.DRAFT);
  const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
  const draft = paramDraft ? paramDraft === 'true' : undefined;
  const depth = typeof paramDepth === 'string' ? parseInt(paramDepth) : 0;
  const select = event.url.searchParams.get(PARAMS.SELECT)?.split(',') || undefined;

  const [error, document] = await trycatch(() =>
    collection.findById({
      id,
      locale: rime.getLocale(),
      depth,
      draft,
      versionId,
      select
    })
  );

  if (error) {
    return handleError(error, { context: 'api' });
  }

  return json({ doc: document });
});
