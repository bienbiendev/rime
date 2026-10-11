import { Hooks } from '#lib/core/pipeline/define-hook.js';
import {
  removeUnusedFiles,
  rowFiles,
  type RowFiles
} from '#lib/core/prototype/collection/upload/disk/delete.server.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import type { CollectionSlug } from '#lib/core/prototype/types.js';
import type { WithUpload } from '#lib/core/prototype/collection/upload/util/config.js';

/**
 * Runs before a delete on an upload collection: notes the files of every row of the document,
 * each version's included, for `cleanUpFiles` to remove once the rows are gone.
 */
export const collectFiles = Hooks.beforeDelete(async function collectFiles(args) {
  const { rime } = args.event.locals;
  const config = args.config as WithUpload<BuiltCollection>;
  const rows = config._versions
    ? await rime
        .collection(config._versions.slug as CollectionSlug)
        .system()
        .find({ query: { where: { ownerId: { equals: args.doc.id } } } })
    : [await rime.collection(config.slug).system().findById({ id: args.doc.id })];

  const uploadFiles = rows.map(rowFiles).filter((row) => row !== null);
  return { ...args, context: { ...args.context, uploadFiles } };
});

/**
 * Runs after a delete on an upload collection: deletes the files `collectFiles` noted, unless
 * another row uses them.
 */
export const cleanUpFiles = Hooks.afterDelete(async function cleanUpFiles(args) {
  const config = args.config as BuiltCollection;
  const stored: RowFiles[] = args.context.uploadFiles ?? [];
  await removeUnusedFiles({ rime: args.event.locals.rime, config, stored });
  return args;
});

/**
 * Runs after an update on an upload collection: deletes the files the update replaced, unless
 * another row uses them.
 */
export const cleanUpReplacedFiles = Hooks.afterUpdate(async function cleanUpReplacedFiles(args) {
  const config = args.config as BuiltCollection;
  const stored: RowFiles[] = args.context.replacedFiles ?? [];
  await removeUnusedFiles({ rime: args.event.locals.rime, config, stored });
  return args;
});
