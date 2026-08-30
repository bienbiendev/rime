import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { extractData } from '$lib/core/rest/extract-data.server.js';
import { trycatch } from '$lib/util/function.js';
import { json, type RequestEvent } from '@sveltejs/kit';
import { isAuthConfig } from '../../features/auth/util.js';

/**
 * POST handler for the collection API endpoint.
 */
export async function restCreate(event: RequestEvent) {
  //
  const { rime } = event.locals;

  // Check if the slug corresponds to a valid collection
  const slug = event.params.slug;
  if (!rime.config.isCollection(slug)) {
    return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
  }

  const collection = rime.collection(slug);

  // Extract data from the request body
  const [extractError, data] = await trycatch(() => extractData(event.request));
  if (extractError) {
    return handleError(extractError, { context: ERROR_CONTEXT.API });
  }

  // Bypass confirm password for api auth collection creation calls
  if (isAuthConfig(collection.config) && 'password' in data) {
    data.confirmPassword = data.password;
  }

  // Set the locale if provided in the data
  if (data.locale) {
    rime.setLocale(data.locale);
  }

  const [error, document] = await trycatch(() =>
    collection.create({ data, locale: rime.getLocale() })
  );

  if (error) {
    return handleError(error, { context: ERROR_CONTEXT.API });
  }

  return json({ doc: document });
}
