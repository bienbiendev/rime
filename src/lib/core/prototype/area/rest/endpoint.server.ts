import { RimeError } from '#lib/core/errors/index.js';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

/** The area API for this request: the type `rime.area(slug)` hands back. */
type AreaApi = ReturnType<App.Locals['rime']['area']>;

type Run = (args: { event: RequestEvent; area: AreaApi }) => Promise<Response>;

/**
 * The area counterpart of the collection wrapper — see the note there for why the check stays
 * per-prototype rather than being folded into one shared helper: `isArea` narrows the slug, and
 * that narrowing is what the accessor needs.
 */
export const endpoint =
  (run: Run): RequestHandler =>
  (event) => {
    const { rime } = event.locals;
    const slug = rime.routes.slug;

    if (!rime.config.isArea(slug)) throw new RimeError(RimeError.NOT_FOUND);

    return run({ event, area: rime.area(slug) });
  };
