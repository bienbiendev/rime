import { PARAMS } from '$lib/core/constant.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { extractData } from '$lib/core/operations/extract-data.server.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import { trycatch } from '$lib/util/function.js';
import { json, type RequestEvent } from '@sveltejs/kit';

export default function (slug: CollectionSlug) {
  //
  async function PATCH(event: RequestEvent) {
    const { rime } = event.locals;

    const id = event.params.id;
    if (!id) throw new RimeError(RimeError.NOT_FOUND);

    const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;
    const draft = event.url.searchParams.get(PARAMS.DRAFT)
      ? event.url.searchParams.get(PARAMS.DRAFT) === 'true'
      : undefined;

    const [extractError, data] = await trycatch(() => extractData(event.request));

    if (extractError) {
      return handleError(extractError, { context: 'api' });
    }

    if (data.locale) {
      rime.setLocale(data.locale);
    }

    const [error, document] = await trycatch(() =>
      rime.collection(slug).updateById({
        id,
        data,
        locale: rime.getLocale(),
        versionId,
        draft
      })
    );

    if (error) {
      return handleError(error, { context: 'api' });
    }

    return json({ doc: document });
  }

  return PATCH;
}
