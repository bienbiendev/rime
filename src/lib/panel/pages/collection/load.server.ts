import type { Directory } from '$lib/core/features/upload/types.js';
import {
  buildUploadAria,
  getParentPath,
  removePathFromLastAria,
  type UploadPath
} from '$lib/core/features/upload/util/path.js';
import { UPLOAD_PATH } from '$lib/core/constant.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { logger } from '$lib/core/logger/index.server.js';
import { withDirectoriesSuffix } from '$lib/core/naming.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import type { Route } from '$lib/panel/types.js';
import { panelUrlFor } from '$lib/panel/util/url.js';
import { trycatch } from '$lib/util/function.js';
import { redirect, type ServerLoadEvent } from '@sveltejs/kit';

type Data = {
  aria: Partial<Route>[];
  docs: GenericDoc[];
  canCreate: boolean;
  status: number;
  upload?: { directories: Directory[]; currentPath: UploadPath; parentDirectory: Directory };
};

/**
 * Load function for the collection page in the panel.
 */
export async function collectionLoad(event: ServerLoadEvent): Promise<Data> {
  //
  const { rime, locale, user } = event.locals;
  const panelSegment = event.params.panel;

  const slug = event.params.slug || '';
  if (!rime.config.isCollection(slug)) {
    throw handleError(new RimeError(RimeError.NOT_FOUND), { context: 'load' });
  }

  const collection = rime.collection(slug);
  const authorizedCreate = collection.config.access.create(user, {});

  const docs = await collection.find({
    locale,
    draft: true
  });

  let aria: Partial<Route>[] = [
    { title: 'Dashboard', url: panelUrlFor(panelSegment) },
    { title: collection.config.label.plural }
  ];

  let data: Data = {
    aria,
    docs,
    canCreate: authorizedCreate,
    status: 200
  };

  if (collection.config.upload) {
    let directories: any[] = [];
    const paramUploadPath = event.url.searchParams.get('uploadPath') as UploadPath | null;
    const currentDirectoryPath = paramUploadPath || UPLOAD_PATH.ROOT_NAME;
    const directoryCollection = rime.collection<any>(withDirectoriesSuffix(slug));
    // Check if dir exists
    const [error, currentDirectory] = await trycatch(() =>
      directoryCollection.findById({
        id: currentDirectoryPath
      })
    );

    // If doesn't exists and path is root then create it
    if (!currentDirectory && currentDirectoryPath === UPLOAD_PATH.ROOT_NAME) {
      await directoryCollection.create({
        data: { id: UPLOAD_PATH.ROOT_NAME }
      });
    } else if (error) {
      logger.error(`${paramUploadPath} doesn't exists`);
      return redirect(301, event.url.pathname);
    }

    directories = await directoryCollection.find({
      query: `where[parent][equals]=${currentDirectoryPath}`,
      sort: 'name'
    });

    const parentPath = getParentPath(currentDirectoryPath);
    let parentDirectory;

    if (parentPath) {
      const [parentError, result] = await trycatch(() =>
        directoryCollection.findById({
          id: parentPath
        })
      );

      if (parentError) {
        throw handleError(parentError, { context: 'load' });
      }
      parentDirectory = result;

      const collectionAria = {
        title: collection.config.label.plural,
        url: panelUrlFor(panelSegment, collection.config.kebab)
      };
      aria = [...aria].slice(0, -1);
      aria = [
        ...aria,
        collectionAria,
        ...buildUploadAria({ path: currentDirectoryPath, slug, panelSegment })
      ];
      data.aria = removePathFromLastAria(aria);
    }

    data = {
      ...data,
      upload: { directories, currentPath: currentDirectoryPath, parentDirectory }
    };
  }

  return data;
}
