import { apiUrl } from '$lib/core/api/index.js';
import { buildUploadAria, type UploadPath } from '$lib/core/collections/upload/util/path.js';
import { PARAMS, UPLOAD_PATH } from '$lib/core/constant.js';
import { handleError } from '$lib/core/errors/handler.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/naming.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import type { CollectionDocData } from '$lib/panel/index.js';
import type { Route } from '$lib/panel/types.js';
import { panelUrl } from '$lib/panel/util/url.js';
import { trycatch } from '$lib/util/function.js';
import { toKebabCase } from '$lib/util/string.js';
import { error, type ServerLoadEvent } from '@sveltejs/kit';

/****************************************************/
/* Document Load
/****************************************************/
export function docLoad(slug: string, withVersion?: boolean) {
  //
  const load = async <V extends boolean = boolean>(event: ServerLoadEvent) => {
    const { locale, user, rime } = event.locals;
    const { id } = event.params;

    if (!id) throw error(404, 'Not found');

    let doc: GenericDoc;
    let readOnly = false;

    if (!rime.config.isCollection(slug)) {
      throw handleError(new RimeError(RimeError.NOT_FOUND), { context: 'load' });
    }

    const collection = rime.collection(slug);
    const operation = id === 'create' ? 'create' : 'update';

    if (id === 'create') {
      /** Check for authorizations */
      const authorized = collection.config.access.create(user, {});
      if (!authorized) {
        return { doc: {}, operation, status: 401, readOnly: true } as CollectionDocData<false>;
      }
      doc = collection.blank();
    } else {
      /** Check for authorizations */
      const authorizedRead = collection.config.access.read(user, { id });
      const authorizedUpdate = collection.config.access.update(user, { id });
      if (!authorizedRead && !authorizedUpdate) {
        return { doc: {}, operation, status: 401, readOnly: true } as CollectionDocData<false>;
      }

      const versionId = event.url.searchParams.get(PARAMS.VERSION_ID) || undefined;

      /** Get doc */
      const [error, document] = await trycatch(() =>
        collection.findById({ id, locale, versionId, draft: true })
      );
      doc = document;

      if (error) {
        throw handleError(error, { context: 'load' });
      }

      /** If update not allowed set doc as readOnly  */
      if (authorizedRead && !authorizedUpdate) {
        readOnly = true;
      }
    }

    let aria: Partial<Route>[];

    const collectionAria = {
      title: collection.config.label.plural,
      url: panelUrl(collection.config.kebab)
    };
    if (collection.config.upload) {
      const paramUploadPath = event.url.searchParams.get('uploadPath') as UploadPath | null;
      const currentDirectoryPath = paramUploadPath || UPLOAD_PATH.ROOT_NAME;
      aria = [
        { title: 'Dashboard', icon: 'dashboard', url: panelUrl() },
        collectionAria,
        ...buildUploadAria({ path: currentDirectoryPath, slug }),
        { title: undefined } // Will be populated by title context
      ];
    } else {
      aria = [
        { title: 'Dashboard', icon: 'dashboard', url: panelUrl() },
        { title: collection.config.label.plural, url: panelUrl(collection.config.kebab) },
        { title: undefined } // Will be populated by title context
      ];
    }

    let data: Partial<CollectionDocData> = {
      aria,
      doc,
      operation,
      status: 200,
      hasMailer: 'mailer' in rime,
      readOnly
    };

    if (withVersion) {
      const url = `${apiUrl(withVersionsSuffix(toKebabCase(doc._type)))}?where[ownerId][equals]=${doc.id}&sort=-updatedAt&select=updatedAt,status`;
      const promise = event.fetch(url).then((r) => r.json());
      const [error, result] = await trycatch(() => promise);
      if (error || !Array.isArray(result.docs)) {
        throw new RimeError(RimeError.OPERATION_ERROR, 'while getting versions');
      }
      data = { ...data, versions: result.docs };
    }

    return data as CollectionDocData<V>;
  };

  return load;
}
