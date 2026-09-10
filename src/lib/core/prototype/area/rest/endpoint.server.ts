import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

/** See the collection wrapper for why this comes from the accessor and not from `../index`. */
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
    const slug = event.params.slug;

    if (!rime.config.isArea(slug)) {
      return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
    }

    return run({ event, area: rime.area(slug) });
  };
