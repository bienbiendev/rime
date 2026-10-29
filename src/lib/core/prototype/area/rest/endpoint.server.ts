import { RimeError } from '#lib/core/errors/index.js';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

/** The area API for this request: the type `rime.area(slug)` hands back. */
type AreaApi = ReturnType<App.Locals['rime']['area']>;

type Run = (args: { event: RequestEvent; area: AreaApi }) => Promise<Response>;

/**
 * Wraps an area REST handler: reads the slug the URL names, refuses what is not an area, and
 * hands `rime.area(slug)` to the handler. `isArea` is a type guard, and its narrowing is what
 * lets the accessor typecheck, as in collection/rest/endpoint.server.ts.
 */
export const endpoint =
  (run: Run): RequestHandler =>
  (event) => {
    const { rime } = event.locals;
    const slug = rime.routes.slug;

    if (!rime.config.isArea(slug)) throw new RimeError(RimeError.NOT_FOUND);

    return run({ event, area: rime.area(slug) });
  };
