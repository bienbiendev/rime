import { fileForDocument } from '$lib/core/prototype/collection/upload/util/converter.server.js';
import { VersionOperations } from '$lib/core/versions/strategy.js';
import { VERSIONS_STATUS } from '$lib/core/versions/constant.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/versions/naming.js';
import { recursiveRemoveKeys } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/types.js';
import type { ConfigMap } from '$lib/core/pipeline/config-map/types.js';
import { fallbackDataFromOriginal } from './fallback-data-from-original.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';

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
 * The third branch it used to have — "not versioned: the content is on the document's own row" —
 * is gone, because that is the default now. It was the only reason both prototypes had to list
 * this hook by name: gating it behind `enabled` used to leave `contentOwnerId` unset on every
 * non-versioned config.
 *
 * Its marks had to be completed to survive the move. Both prototypes listed it by hand between
 * `buildOriginalDocConfigMap` and `buildDataConfigMap`, so two constraints it depends on were
 * being met by that hand-written position rather than by anything it declared:
 *
 * - **`requires: 'original-config-map'`** — `prepareDataForNewVersion` reads `originalConfigMap`,
 *   and the throw below has always said so. Only `original-doc` was declared.
 * - **`provides: 'data-inspected'`** — it reads the caller's submission *as sent*. Whatever the
 *   caller did not send, `fallbackDataFromOriginal` fills from the previous version. Let
 *   `setDefaultValues` run first and those fields arrive already filled with their config
 *   defaults, so editing one field of a document would reset every unsent field to its default
 *   instead of carrying it forward. That is what the mark means, and it is what pins this ahead
 *   of `buildDataConfigMap` now that no list does.
 */
export const handleNewVersion = Hooks.beforeUpsert({
  name: 'handleNewVersion',
  feature: 'versions',
  run: async (args) => {
    const { config, event } = args;
    const { rime } = event.locals;

    const { versionOperation, originalDoc, originalConfigMap, params } = args.context;

    if (!originalConfigMap)
      throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalConfigMap @handleNewVersion');
    if (!originalDoc)
      throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @handleNewVersion');
    if (!versionOperation)
      throw new RimeError(RimeError.OPERATION_ERROR, 'missing versionOperation @handleNewVersion');

    if (VersionOperations.isSpecificVersionUpdate(versionOperation)) {
      return {
        ...args,
        context: { ...args.context, contentOwnerId: originalDoc.versionId }
      };
    }

    if (VersionOperations.isNewVersionCreation(versionOperation)) {
      const data = await prepareDataForNewVersion({
        data: args.data,
        originalDoc,
        config,
        originalConfigMap
      });
      const versionsSlug = withVersionsSuffix(config.slug);

      const document = await rime.collection(versionsSlug).create({
        data,
        locale: params.locale
      });

      if (config.versions && config.versions.maxVersions) {
        await rime.collection(versionsSlug).delete({
          sort: '-updatedAt',
          query: 'where[status][not_equals]=published',
          offset: config.versions.maxVersions
        });
      }

      return { ...args, context: { ...args.context, contentOwnerId: document.id } };
    }

    // Versioned, but this update writes neither a named version nor a new one — the default
    // `resolveContentOwner` set stands.
    return args;
  }
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
   * docs/decoupling.md § 4.6 names — what a new content row inherits is a question this feature
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
