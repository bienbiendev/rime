import { dashboardCrumb } from '#lib/panel/pages/aria.server.js';
import { PARAMS } from '#lib/core/constants.js';
import { RimeError } from '#lib/core/errors/index.js';
import { autoSavesOf } from '#lib/core/prototype/shared/versions/auto-saves.server.js';
import type { AreaSlug } from '#lib/core/prototype/types.js';
import { slugOf } from '#lib/core/routes/context.server.js';
import type { AreaDocData } from '#lib/panel/index.js';
import type { Route } from '#lib/panel/types.js';
import type { ServerLoadEvent } from '@sveltejs/kit';

export async function areaLoad(event: ServerLoadEvent) {
  const { locals, url } = event;
  const { rime, locale } = locals;
  const slug = (slugOf(event) || '') as AreaSlug;

  const area = rime.area(slug);
  const authorizedRead = area.config.access.read(locals.user, {});
  const authorizedUpdate = area.config.access.update(locals.user, {});

  if (!authorizedRead) throw new RimeError(RimeError.UNAUTHORIZED);

  const aria: Partial<Route>[] = [dashboardCrumb(rime), { title: area.config.label }];

  // The newest row unless `?versionId` names one, as a collection document opens
  const versionId = url.searchParams.get(PARAMS.VERSION_ID) || undefined;
  const doc = await area.find({ locale, versionId, latest: true });

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
