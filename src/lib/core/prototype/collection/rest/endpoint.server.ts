import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

/**
 * The collection API for this request. Taken from the accessor rather than imported from
 * `../index.server.js`, which declares it: that import would close a cycle (definition -> rest
 * -> handler -> here -> definition), and this is the same type by construction — what
 * `rime.collection(slug)` hands back.
 */
type CollectionApi = ReturnType<App.Locals['rime']['collection']>;

type Run = (args: { event: RequestEvent; collection: CollectionApi }) => Promise<Response>;

/**
 * Wraps a collection REST handler with the check every one of them opened with.
 *
 * Seven handlers each read `event.params.slug`, refused what was not a collection, and looked up
 * `rime.collection(slug)` — the same six lines, differing in nothing. The lookup is the reason
 * the check cannot simply be deleted and left to the param matcher: `isCollection` is a type
 * guard (`slug is CollectionSlug`), and that narrowing is what makes the accessor typecheck.
 *
 * The returned handler's type is annotated rather than inferred on purpose. Inference would walk
 * a body that mentions the collection API, and this handler ends up inside
 * `App.Locals['routes']` — the shape that made every `rime.collection(...)` in the repo resolve
 * to `never` during the local-API move.
 */
export const endpoint =
  (run: Run): RequestHandler =>
  (event) => {
    const { rime } = event.locals;
    const slug = event.params.slug;

    if (!rime.config.isCollection(slug)) {
      return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
    }

    return run({ event, collection: rime.collection(slug) });
  };
