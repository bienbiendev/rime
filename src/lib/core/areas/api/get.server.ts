import { PARAMS } from '$lib/core/constant.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import type { AreaSlug } from '$lib/core/types/doc.js';
import { trycatch } from '$lib/util/function.js';
import type { Dic } from '$lib/util/types.js';
import { json, type RequestEvent } from '@sveltejs/kit';

export default function (slug: AreaSlug) {
  //
  async function GET(event: RequestEvent) {
    const { rime } = event.locals;

    const params = event.url.searchParams;
    const areaAPI = rime.area(slug);

    function buildSelect(params: typeof event.url.searchParams) {
      const paramSelect = params.get(PARAMS.SELECT)
        ? params.get(PARAMS.SELECT)!.split(',')
        : undefined;
      if (
        paramSelect &&
        paramSelect.includes('title') &&
        !paramSelect.includes(areaAPI.config.asTitle)
      ) {
        paramSelect.push(areaAPI.config.asTitle);
      }
      return paramSelect;
    }

    const apiParams: Dic = {
      locale: rime.getLocale(),
      draft: params.get(PARAMS.DRAFT) ? params.get(PARAMS.DRAFT) === 'true' : undefined,
      versionId: params.get(PARAMS.VERSION_ID) || undefined,
      depth: params.get(PARAMS.DEPTH) ? parseInt(params.get(PARAMS.DEPTH)!) : 0,
      select: buildSelect(params)
    };

    const [error, doc] = await trycatch(() => rime.area(slug).find(apiParams));

    if (error) {
      return handleError(error, { context: 'api' });
    }

    return json({ doc });
  }

  return GET;
}
