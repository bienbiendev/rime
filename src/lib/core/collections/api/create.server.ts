import { handleError } from '$lib/core/errors/handler.server.js';
import { extractData } from '$lib/core/operations/extract-data.server.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import { trycatch } from '$lib/util/function.js';
import { json, type RequestEvent } from '@sveltejs/kit';
import { isAuthConfig } from '../auth/util.js';

export default function (slug: CollectionSlug) {
  //
  async function POST(event: RequestEvent) {
    const { rime } = event.locals;

    const collection = rime.collection(slug);
    const [extractError, data] = await trycatch(() => extractData(event.request));
    if (extractError) {
      return handleError(extractError, { context: 'api' });
    }

    // Bypass confirm password for api auth collection creation calls
    if (isAuthConfig(collection.config) && 'password' in data) {
      data.confirmPassword = data.password;
    }

    if (data.locale) {
      rime.setLocale(data.locale);
    }

    const [error, document] = await trycatch(() =>
      collection.create({ data, locale: rime.getLocale() })
    );

    if (error) {
      return handleError(error, { context: 'api' });
    }

    return json({ doc: document });
  }

  return POST;
}
