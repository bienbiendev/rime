import { PARAMS } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';
import { autoSavesOf } from '$lib/core/prototype/shared/versions/auto-saves.server.js';
import { withVersionsSuffix } from '$lib/core/prototype/shared/versions/naming.js';
import type { AreaSlug } from '$lib/core/prototype/types.js';
import { apiUrl } from '$lib/core/routes/util.js';
import type { AreaDocData } from '$lib/panel/index.js';
import type { Route } from '$lib/panel/types.js';
import { trycatch } from '$lib/util/function.js';
import type { ServerLoadEvent } from '@sveltejs/kit';

export async function areaLoad<V extends boolean = boolean>(
  event: ServerLoadEvent,
  withVersions?: V
) {
  //
  const { locals, url, fetch } = event;
  const { rime, locale } = locals;
  const slug = (event.params.slug || '') as AreaSlug;

  const area = rime.area(slug);
  const authorizedRead = area.config.access.read(locals.user, {});
  const authorizedUpdate = area.config.access.update(locals.user, {});

  if (!authorizedRead) {
    throw handleError(new RimeError(RimeError.UNAUTHORIZED), { context: ERROR_CONTEXT.LOAD });
  }

  const aria: Partial<Route>[] = [
    { title: 'Dashboard', icon: 'dashboard', url: rime.routes.panelUrl() },
    { title: area.config.label }
  ];

  const versionId = url.searchParams.get(PARAMS.VERSION_ID) || undefined;
  const draft = url.searchParams.get(PARAMS.DRAFT)
    ? url.searchParams.get(PARAMS.DRAFT) === 'true'
    : undefined;
  const doc = await area.find({ locale, versionId, draft });

  // An auto-saved row is its owner's. Anybody else reaching it by its versionId can look.
  const owner = doc.updatedBy as { id?: string } | null | undefined;
  const isOthersAutoSave = !!doc.isAutoSave && owner?.id !== locals.user?.id;

  let data: Partial<AreaDocData> = {
    aria,
    doc,
    operation: 'update',
    status: 200,
    readOnly: !authorizedUpdate || isOthersAutoSave,
    autoSaves: await autoSavesOf({ event, config: area.config, doc })
  };

  if (withVersions) {
    const url = `${apiUrl(prototypeKebab(withVersionsSuffix(doc._type)))}?where[ownerId][equals]=${doc.id}&sort=-updatedAt&select=updatedAt,status`;
    const promise = fetch(url).then((r) => r.json());
    const [error, result] = await trycatch(promise);
    if (error || !Array.isArray(result.docs)) {
      throw new RimeError(RimeError.OPERATION_ERROR, 'while getting versions');
    }
    data = { ...data, versions: result.docs };
  }

  return data as AreaDocData<V>;
}
