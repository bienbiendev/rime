import { PARAMS } from '$lib/core/constants.js';
import { ERROR_CONTEXT, handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { autoSavesOf } from '$lib/core/prototype/shared/versions/auto-saves.server.js';
import type { AreaSlug } from '$lib/core/prototype/types.js';
import type { AreaDocData } from '$lib/panel/index.js';
import type { Route } from '$lib/panel/types.js';
import type { ServerLoadEvent } from '@sveltejs/kit';

export async function areaLoad(event: ServerLoadEvent) {
  //
  const { locals, url } = event;
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
  const latest = url.searchParams.get(PARAMS.LATEST) === 'true' || undefined;
  const doc = await area.find({ locale, versionId, latest });

  const data: Partial<AreaDocData> = {
    aria,
    doc,
    operation: 'update',
    status: 200,
    readOnly: !authorizedUpdate,
    autoSaves: await autoSavesOf({ event, config: area.config, doc })
  };

  return data as AreaDocData;
}
