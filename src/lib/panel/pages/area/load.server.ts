import { PARAMS } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import type { AreaSlug } from '$lib/core/prototype/types.js';
import type { AreaDocData } from '$lib/panel/index.js';
import type { Route } from '$lib/panel/types.js';
import { panelUrlFor } from '$lib/panel/util/url.js';
import { trycatch } from '$lib/util/function.js';
import { apiUrl } from '$lib/util/index.js';
import { toKebabCase } from '$lib/util/string.js';
import type { ServerLoadEvent } from '@sveltejs/kit';

export async function areaLoad<V extends boolean = boolean>(
  event: ServerLoadEvent,
  withVersions?: V
) {
  //
  const { locals, url, fetch } = event;
  const { rime, locale } = locals;
  const slug = (event.params.slug || '') as AreaSlug;
  const panelSegment = event.params.panel;

  const area = rime.area(slug);
  const authorizedRead = area.config.access.read(locals.user, {});
  const authorizedUpdate = area.config.access.update(locals.user, {});

  if (!authorizedRead) {
    throw handleError(new RimeError(RimeError.UNAUTHORIZED), { context: ERROR_CONTEXT.LOAD });
  }

  const aria: Partial<Route>[] = [
    { title: 'Dashboard', icon: 'dashboard', url: panelUrlFor(panelSegment) },
    { title: area.config.label }
  ];

  const versionId = url.searchParams.get(PARAMS.VERSION_ID) || undefined;
  const draft = url.searchParams.get(PARAMS.DRAFT)
    ? url.searchParams.get(PARAMS.DRAFT) === 'true'
    : undefined;
  const doc = await area.find({ locale, versionId, draft });

  let data: Partial<AreaDocData> = {
    aria,
    doc,
    operation: 'update',
    status: 200,
    readOnly: !authorizedUpdate
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
}
