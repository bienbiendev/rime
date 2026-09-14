import { isStaff } from '$lib/core/auth/access.js';
import { PARAMS } from '$lib/core/constants.js';
import { RimeError } from '$lib/core/errors/index.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { selectWithTitle } from '$lib/core/prototype/shared/title/select.js';
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

  // A row other than the published one is staff's to see: from anyone else, `latest` and
  // `versionId` read as absent.
  const staff = isStaff(event.locals.user);
  const paramDepth = event.url.searchParams.get(PARAMS.DEPTH);
  const paramLatest = event.url.searchParams.get(PARAMS.LATEST);
  const versionId = staff ? event.url.searchParams.get(PARAMS.VERSION_ID) || undefined : undefined;
  const latest = staff && paramLatest ? paramLatest === 'true' : undefined;
  const depth = typeof paramDepth === 'string' ? parseInt(paramDepth) : 0;
  const select = selectWithTitle(
    event.url.searchParams.get(PARAMS.SELECT),
    collection.config.asTitle
  );

  const [error, document] = await trycatch(() =>
    collection.findById({
      id,
      locale: rime.getLocale(),
      depth,
      latest,
      versionId,
      select
    })
  );

  if (error) {
    return handleError(error, { context: 'api' });
  }

  return json({ doc: document });
});
