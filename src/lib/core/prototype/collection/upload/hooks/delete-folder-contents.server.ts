import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { directoriesOf } from '#lib/core/prototype/collection/upload/naming.js';
import { isUploadConfig } from '#lib/core/prototype/collection/upload/util/config.js';

/**
 * Runs before a `$<slug>Directories` row is deleted: deletes its sub-folders, then the documents
 * filed in it, as rime. Each sub-folder runs this hook in turn, so the whole tree goes, and each
 * document's own delete hooks remove its files.
 *
 * ```
 * DELETE root:press  ->  root:press:2024 and its documents, then the documents of root:press
 * ```
 */
export const deleteFolderContents = Hooks.beforeDelete<'directory'>(
  async function deleteFolderContents(args) {
    const { rime } = args.event.locals;

    await rime
      .collection(args.config.slug)
      .system()
      .delete({ query: { where: { parent: { equals: args.doc.id } } } });

    // The upload collection the folder belongs to: its versions share its folders
    const upload = rime.config.raw.collections
      .filter(isUploadConfig)
      .find(
        (collection) => !collection._shadowOf && directoriesOf(collection) === args.config.slug
      );
    if (upload) {
      await rime
        .collection(upload.slug)
        .system()
        .delete({ query: { where: { _path: { equals: args.doc.id } } } });
    }

    return args;
  }
);
