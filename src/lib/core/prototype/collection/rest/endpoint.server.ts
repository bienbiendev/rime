import { RimeError } from '#lib/core/errors/index.js';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

/**
 * The collection API for this request, taken from the accessor rather than imported from
 * `../api.server.js`: that import would close a cycle, and this is the same type by construction,
 * what `rime.collection(slug)` hands back.
 */
type CollectionApi = ReturnType<App.Locals['rime']['collection']>;

type Run = (args: { event: RequestEvent; collection: CollectionApi }) => Promise<Response>;

/**
 * Wraps a collection REST handler with the check every one of them needs: read the slug the URL
 * names (`rime.routes.slug`), refuse what is not a collection, look up `rime.collection(slug)`.
 * The param matcher cannot replace it: `isCollection` is a type guard (`slug is CollectionSlug`),
 * and that narrowing is what makes the accessor typecheck.
 *
 * The returned handler's type is annotated rather than inferred. Inference would walk a body that
 * mentions the collection API, and this handler ends up inside `App.Locals['routes']`, so every
 * `rime.collection(...)` would resolve to `never`.
 */
export const endpoint =
  (run: Run): RequestHandler =>
  (event) => {
    const { rime } = event.locals;
    const slug = rime.routes.slug;

    if (!rime.config.isCollection(slug)) throw new RimeError(RimeError.NOT_FOUND);

    return run({ event, collection: rime.collection(slug) });
  };
