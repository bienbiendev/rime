import { apiUrl } from '$lib/core/api/index.js';
import { PARAMS } from '$lib/core/constant.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/naming.js';
import type { AreaSlug } from '$lib/core/types/doc.js';
import type { AreaDocData } from '$lib/panel/index.js';
import type { Route } from '$lib/panel/types.js';
import { panelUrl } from '$lib/panel/util/url.js';
import { trycatch } from '$lib/util/function.js';
import { toKebabCase } from '$lib/util/string.js';
import type { ServerLoadEvent } from '@sveltejs/kit';

export default function <V extends boolean = boolean>(slug: AreaSlug, withVersions?: V) {
  //
  const load = async ({ locals, url, fetch }: ServerLoadEvent) => {
    const { rime, locale } = locals;

    const area = rime.area(slug);
    const authorizedRead = area.config.access.read(locals.user, {});
    const authorizedUpdate = area.config.access.update(locals.user, {});

    const aria: Partial<Route>[] = [
      { title: 'Dashboard', icon: 'dashboard', url: panelUrl() },
      { title: area.config.label }
    ];

    if (!authorizedRead) {
      return {
        aria,
        doc: {},
        operation: 'update',
        status: 401,
        readOnly: true
      } as AreaDocData<false>;
    }

    const versionId = url.searchParams.get(PARAMS.VERSION_ID) || undefined;
    const draft = url.searchParams.get(PARAMS.DRAFT)
      ? url.searchParams.get(PARAMS.DRAFT) === 'true'
      : undefined;
    const doc = await area.find({ locale, versionId, draft });

    if (!authorizedUpdate) {
      return { aria, doc, operation: 'update', status: 200, readOnly: true } as AreaDocData<false>;
    }

    let data: Partial<AreaDocData> = {
      aria,
      doc,
      operation: 'update',
      status: 200,
      readOnly: false
    };

    if (withVersions) {
      const url = `${apiUrl(withVersionsSuffix(toKebabCase(doc._type)))}?where[ownerId][equals]=${doc.id}&sort=-updatedAt&select=updatedAt,status`;
      const promise = fetch(url).then((r) => r.json());
      const [error, result] = await trycatch(promise);
      if (error || !Array.isArray(result.docs)) {
        throw new RimeError(RimeError.OPERATION_ERROR, 'while getting versions');
      }
      data = { ...data, versions: result.docs };
    }

    return data as AreaDocData<V>;
  };
  return load;
}
