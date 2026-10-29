import { dashboardCrumb } from '#lib/panel/pages/aria.server.js';
import { PARAMS } from '#lib/core/constants.js';
import { RimeError } from '#lib/core/errors/index.js';
import { logger } from '#lib/core/logger.server.js';
import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
import { withDirectoriesSuffix } from '#lib/core/prototype/collection/upload/naming.js';
import type { Directory } from '#lib/core/prototype/collection/upload/types.js';
import {
  buildUploadAria,
  getParentPath,
  removePathFromLastAria,
  type UploadPath
} from '#lib/core/prototype/collection/upload/util/path.js';
import type { CollectionSlug, GenericDoc } from '#lib/core/prototype/types.js';
import { slugOf } from '#lib/core/routes/context.server.js';
import type { Route } from '#lib/panel/types.js';
import { trycatch } from '#lib/util/function.js';
import { redirect, type ServerLoadEvent } from '@sveltejs/kit';

type Data = {
  aria: Partial<Route>[];
  docs: GenericDoc[];
  canCreate: boolean;
  status: number;
  upload?: { directories: Directory[]; currentPath: UploadPath; parentDirectory?: Directory };
};

/**
 * The list page, `/panel/[slug]`: every document of the collection, newest rows. An upload
 * collection also loads the folder on screen, see `uploadListing`.
 */
export async function collectionLoad(event: ServerLoadEvent): Promise<Data> {
  const { rime, locale, user } = event.locals;

  const slug = slugOf(event) || '';
  if (!rime.config.isCollection(slug)) throw new RimeError(RimeError.NOT_FOUND);

  const collection = rime.collection(slug);
  const canCreate = collection.config.access.create(user, {});
  const docs = await collection.find({ locale, latest: true });
  const aria: Partial<Route>[] = [dashboardCrumb(rime), { title: collection.config.label.plural }];

  if (!collection.config.upload) return { aria, docs, canCreate, status: 200 };

  const upload = await uploadListing(event, slug);
  return { aria: upload.aria ?? aria, docs, canCreate, status: 200, upload: upload.listing };
}

/**
 * The folder in `?uploadPath` (root by default, created on the first visit), its sub-folders, its
 * parent, and the breadcrumb down to it; an unknown folder redirects to the root.
 */
async function uploadListing(
  event: ServerLoadEvent,
  slug: CollectionSlug
): Promise<{ aria?: Partial<Route>[]; listing: NonNullable<Data['upload']> }> {
  const { rime } = event.locals;
  const paramUploadPath = event.url.searchParams.get(PARAMS.UPLOAD_PATH) as UploadPath | null;
  const currentPath = paramUploadPath || UPLOAD_PATH.ROOT_NAME;
  const directoryCollection = rime.collection<any>(withDirectoriesSuffix(slug));
  const [error, currentDirectory] = await trycatch(() =>
    directoryCollection.findById({ id: currentPath })
  );

  if (!currentDirectory && currentPath === UPLOAD_PATH.ROOT_NAME) {
    await directoryCollection.create({ data: { id: UPLOAD_PATH.ROOT_NAME } });
  } else if (error) {
    logger.error(`${paramUploadPath} doesn't exists`);
    return redirect(301, event.url.pathname);
  }

  const directories = await directoryCollection.find({
    query: `where[parent][equals]=${currentPath}`,
    sort: 'name'
  });

  const parentPath = getParentPath(currentPath);
  const parentDirectory = parentPath
    ? await directoryCollection.findById({ id: parentPath })
    : undefined;
  const listing = { directories, currentPath, parentDirectory };
  if (!parentPath) return { listing };

  const config = rime.config.getCollection(slug);
  const collectionCrumb = { title: config.label.plural, url: rime.routes.panelUrl(config.kebab) };
  const aria = removePathFromLastAria([
    dashboardCrumb(rime),
    collectionCrumb,
    ...buildUploadAria({ path: currentPath, slug, panelSegment: rime.routes.panel })
  ]);
  return { aria, listing };
}
