import { dashboardCrumb } from '#lib/panel/pages/aria.server.js';
import { PARAMS } from '#lib/core/constants.js';
import { RimeError } from '#lib/core/errors/index.js';
import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import {
  buildUploadAria,
  type UploadPath
} from '#lib/core/prototype/collection/upload/util/path.js';
import { autoSavesOf } from '#lib/core/prototype/shared/versions/auto-saves.server.js';
import type { AutoSaves } from '#lib/core/prototype/shared/versions/types.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import { slugOf } from '#lib/core/routes/context.server.js';
import type { CollectionDocData } from '#lib/panel/index.js';
import type { Route } from '#lib/panel/types.js';
import { error, type ServerLoadEvent } from '@sveltejs/kit';

export async function documentLoad(event: ServerLoadEvent) {
  const { locale, user, rime } = event.locals;
  const { id } = event.params;
  const slug = slugOf(event) || '';

  if (!id) throw error(404, 'Not found');

  let doc: GenericDoc;
  let readOnly = false;
  let autoSaves: AutoSaves | undefined;

  if (!rime.config.isCollection(slug)) throw new RimeError(RimeError.NOT_FOUND);

  const collection = rime.collection(slug);
  const operation = id === 'create' ? 'create' : 'update';

  if (id === 'create') {
    const authorized = collection.config.access.create(user, {});
    if (!authorized) throw new RimeError(RimeError.UNAUTHORIZED);
    doc = collection.initial();
  } else {
    const authorizedRead = collection.config.access.read(user, { id });
    const authorizedUpdate = collection.config.access.update(user, { id });
    if (!authorizedRead && !authorizedUpdate) throw new RimeError(RimeError.UNAUTHORIZED);

    const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;

    doc = await collection.findById({ id, locale, versionId, latest: true });

    if (authorizedRead && !authorizedUpdate) {
      readOnly = true;
    }

    autoSaves = await autoSavesOf({ event, config: collection.config, doc });
  }

  let aria: Partial<Route>[];

  const collectionAria = {
    title: collection.config.label.plural,
    url: rime.routes.panelUrl(collection.config.kebab)
  };
  if (collection.config.upload) {
    const paramUploadPath = event.url.searchParams.get(PARAMS.UPLOAD_PATH) as UploadPath | null;
    const currentDirectoryPath = paramUploadPath || UPLOAD_PATH.ROOT_NAME;
    aria = [
      dashboardCrumb(rime),
      collectionAria,
      ...buildUploadAria({ path: currentDirectoryPath, slug, panelSegment: rime.routes.panel }),
      { title: undefined } // Will be populated by title context
    ];
  } else {
    aria = [
      dashboardCrumb(rime),
      {
        title: collection.config.label.plural,
        url: rime.routes.panelUrl(collection.config.kebab)
      },
      { title: undefined } // Will be populated by title context
    ];
  }

  const data: Partial<CollectionDocData> = {
    aria,
    doc,
    operation,
    status: 200,
    hasMailer: 'mailer' in rime,
    readOnly,
    autoSaves
  };

  return data as CollectionDocData;
}
