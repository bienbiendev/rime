import { PARAMS } from '$lib/core/constants.js';
import { RimeError } from '$lib/core/errors/index.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { extractData } from '$lib/core/rest/extract-data.server.js';
import type { AreaSlug } from '$lib/core/types/doc.js';
import { trycatch } from '$lib/util/function.js';
import { json, type RequestEvent } from '@sveltejs/kit';

/**
 * POST handler for the area API endpoint.
 */
export async function restUpdate(event: RequestEvent) {
  //
  const { rime } = event.locals;
  const slug = event.params.slug as AreaSlug;

  // Check if the slug corresponds to a valid area
  if (!rime.config.isArea(slug)) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
  }

  // Extract versionId and draft parameters from the request URL
  const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
  const draft = event.url.searchParams.get(PARAMS.DRAFT)
    ? event.url.searchParams.get(PARAMS.DRAFT) === 'true'
    : undefined;

  // Extract data from the request body
  const [extractError, data] = await trycatch(() => extractData(event.request));
  if (extractError) {
    return handleError(extractError, { context: ERROR_CONTEXT.API });
  }

  // Set the locale if provided in the data
  if (data.locale) {
    rime.setLocale(data.locale);
  }

  // Update the area with the extracted data, versionId, draft status, and current locale
  const [error, doc] = await trycatch(() =>
    rime.area(slug).update({
      data,
      versionId,
      draft,
      locale: rime.getLocale()
    })
  );

  if (error) {
    return handleError(error, { context: ERROR_CONTEXT.API });
  }

  return json({ doc });
}
