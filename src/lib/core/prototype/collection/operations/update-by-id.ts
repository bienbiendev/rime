import type { BuiltCollection } from '#lib/core/config/types.js';
import { runUpdate } from '#lib/core/pipeline/run.server.js';
import type { OperationContext } from '#lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '#lib/core/prototype/define.js';
import type { CollectionSlug, GenericDoc } from '#lib/core/prototype/types.js';
import type { UpdateArgs } from '#lib/core/prototype/shared/operations/update-args.js';

export type UpdateByIdArgs<T> = UpdateArgs<T> & { id: string };

type Args<T> = UpdateByIdArgs<T> & { ctx: PrototypeApiContext<BuiltCollection> };

/**
 * Updates a document by ID.
 *
 * The pipeline itself lives in `pipeline/run.server.ts` (`runUpdate`) — shared with an area's
 * update. Only the two prototype-specific pieces are here: which adapter method writes the root
 * row, and how the saved document is read back.
 */
export const updateById = async <T extends GenericDoc = GenericDoc>(args: Args<T>) => {
  const { ctx, locale, id, latest, fork, isLocaleCopy } = args;
  const { event, isSystemOperation } = ctx;
  const { rime } = event.locals;

  const context: OperationContext<CollectionSlug> = {
    params: {
      id,
      versionId: args.versionId,
      latest,
      fork,
      autoSave: args.autoSave,
      locale
    },
    isSystemOperation,
    isLocaleCopy
  };

  return runUpdate<CollectionSlug, T, BuiltCollection>({
    data: args.data,
    config: ctx.config,
    event,
    context,
    locale,
    where: 'updateById',

    // The plan says which rows this write touches; the adapter writes what it is handed.
    write: ({ plan, config }) =>
      rime.adapter.collection(config.slug).update({ id, ...plan, locale }),

    /**
     * Read back **the row the write went to**, not the one the caller asked for.
     *
     * `context.contentOwnerId` is what `handleNewVersion` answered and what step 4 wrote to. On a
     * new-version update it is the version just created, which `params.versionId` cannot name.
     *
     * `runUpdate` asserts `contentOwnerId` before the write, so it is always set by now. A config
     * with no versions ignores the parameter entirely (see `readPrototype` in the adapter), where
     * it is the document's own id anyway.
     */
    reread: ({ written, config, context }) =>
      rime.collection(config.slug).system().findById({
        id: written.id,
        locale,
        versionId: context.contentOwnerId
      }) as Promise<T>
  });
};
