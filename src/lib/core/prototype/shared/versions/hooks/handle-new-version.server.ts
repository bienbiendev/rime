import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { fileForDocument } from '$lib/core/prototype/collection/upload/util/converter.server.js';
import { VersionOperations } from '$lib/core/prototype/shared/versions/strategy.js';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/prototype/shared/versions/naming.js';
import { recursiveRemoveKeys } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/types.js';
import type { ConfigMap } from '$lib/core/pipeline/config-map/types.js';
import { fallbackDataFromOriginal } from './fallback-data-from-original.js';
import { retireAutoSaves } from '../retire-auto-saves.server.js';

/**
 * Where a versioned document's content lives for *this* update — overriding the default.
 *
 * `resolveContentOwner` has already said "the document's own row", which is right for every
 * prototype with no versions. This runs after it, only on a config that enables `versions`, and
 * answers again:
 *
 * - **a specific version** — that row.
 * - **a new version** — the row this hook creates, through the public API, which is what makes
 *   the write plan's third case ("already written") true.
 *
 * On a config that auto-saves it also says what the row is. An auto-save keeps its row an
 * auto-saved draft; any other write on a specific version clears the flag, which is how an
 * auto-save becomes a version. A new auto-save replaces the caller's previous one on the document
 * — one per user and document — and the flag is set on the row after the insert, because
 * `stripAutoSaveFlag` takes it out of every submission, this create's included.
 *
 * **Two things pin where it sits in the list**, and both are silent if broken:
 *
 * - It runs after `buildOriginalDocConfigMap`, because `prepareDataForNewVersion` reads
 *   `originalConfigMap` — the throw below says so.
 * - It runs before `setDefaultValues`, because it reads the caller's submission *as sent*:
 *   whatever was not sent, `fallbackDataFromOriginal` fills from the previous version. Let the
 *   defaults land first and editing one field resets every unsent field to its default instead of
 *   carrying it forward.
 */
export const handleNewVersion = Hooks.beforeUpsert(async function handleNewVersion(args) {
  const { config, event } = args;
  const { rime } = event.locals;

  const { versionOperation, originalDoc, originalConfigMap, params } = args.context;

  if (!originalConfigMap)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalConfigMap @handleNewVersion');
  if (!originalDoc)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @handleNewVersion');
  if (!versionOperation)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing versionOperation @handleNewVersion');

  const autoSaves = !!config.versions?.autoSave;

  if (VersionOperations.isSpecificVersionUpdate(versionOperation)) {
    const data = !autoSaves
      ? args.data
      : params.autoSave
        ? { ...args.data, status: VERSIONS_STATUS.DRAFT, isAutoSave: true }
        : { ...args.data, isAutoSave: false };

    return {
      ...args,
      data,
      context: { ...args.context, contentOwnerId: originalDoc.versionId }
    };
  }

  if (VersionOperations.isNewVersionCreation(versionOperation)) {
    const isAutoSave = VersionOperations.isAutoSaveCreation(versionOperation);
    const userId = event.locals.user?.id;

    if (isAutoSave && !userId) {
      throw new RimeError(RimeError.UNAUTHORIZED, 'an auto-save belongs to a user');
    }

    const data = await prepareDataForNewVersion({
      data: args.data,
      originalDoc,
      config,
      originalConfigMap
    });
    if (isAutoSave) data.status = VERSIONS_STATUS.DRAFT;

    const versionsSlug = withVersionsSuffix(config.slug);

    if (isAutoSave) {
      await retireAutoSaves({ event, config, docId: originalDoc.id, userId: userId! });
    }

    const document = await rime.collection(versionsSlug).create({
      data,
      locale: params.locale
    });

    if (isAutoSave) {
      await rime.adapter.contentOwner(config.slug).updateWhere({
        query: `where[id][equals]=${document.id}`,
        data: { isAutoSave: true }
      });
    } else if (config.versions && config.versions.maxVersions) {
      // Bookkeeping, as rime itself: the editor writing a version need not hold `access.delete`.
      await rime
        .collection(versionsSlug)
        .system()
        .delete({
          sort: '-updatedAt',
          query: autoSaves
            ? 'where[and][0][status][not_equals]=published&where[and][1][isAutoSave][not_equals]=true'
            : 'where[status][not_equals]=published',
          offset: config.versions.maxVersions
        });
    }

    return { ...args, context: { ...args.context, contentOwnerId: document.id } };
  }

  // Versioned, but this update writes neither a named version nor a new one — the default
  // `resolveContentOwner` set stands.
  return args;
});

async function prepareDataForNewVersion(args: {
  data: Dic;
  config: BuiltCollection | BuiltArea;
  originalDoc: Dic;
  originalConfigMap: ConfigMap;
}) {
  const { config, originalDoc, originalConfigMap } = args;
  let data = { ...args.data };

  /**
   * A new version of an upload document inherits the file the old one had, unless the write brings
   * a new one — the version row has its own `filename`, so without this a revision of a document
   * nobody re-uploaded to comes out with no file.
   *
   * This asked `upload` for two things: where it keeps its files, and how to turn a path into a
   * `File`. It asks for one now. The remaining import is the genuine cross-feature dependency
   * what a new content row inherits is a question this feature
   * has and only that one can answer — and it is one call rather than a copy of a convention.
   */
  if (config.type === 'collection' && config.upload && !data.file) {
    data.file = (await fileForDocument(originalDoc)) ?? data.file;
  }

  // Use missing required data from original version
  data = await fallbackDataFromOriginal({
    data,
    original: originalDoc,
    configMap: originalConfigMap,
    ignore: ['status'],
    mode: 'all'
  });

  // Set default status to "draft" if no data.status
  if (!data.status) {
    data.status = VERSIONS_STATUS.DRAFT;
  }

  // Remove ownerId and id props from data this force new relation/blocks creations
  data = recursiveRemoveKeys('ownerId', 'id').from(data);

  data.ownerId = originalDoc.id;
  delete data.id;

  return data;
}
