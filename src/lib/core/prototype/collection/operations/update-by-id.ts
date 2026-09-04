import type { BuiltCollection } from '$lib/core/config/types.js';
import { runUpdate } from '$lib/core/pipeline/run.server.js';
import type { OperationContext } from '$lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { DeepPartial } from '$lib/util/types.js';

export type UpdateByIdArgs<T> = {
  id: string;
  versionId?: string;
  draft?: boolean;
  data: DeepPartial<T>;
  locale?: string | undefined;
  isFallbackLocale?: string | undefined;
};

type Args<T> = UpdateByIdArgs<T> & { ctx: PrototypeApiContext<BuiltCollection> };

/**
 * Updates a document by ID.
 *
 * The pipeline itself lives in operations/run.server.ts — shared with an area's update. Only
 * the two prototype-specific pieces are here: which adapter method writes the root row, and
 * how the saved document is read back.
 */
export const updateById = async <T extends GenericDoc = GenericDoc>(args: Args<T>) => {
  const { ctx, locale, id, draft, isFallbackLocale = undefined } = args;
  const { event, isSystemOperation } = ctx;
  const { rime } = event.locals;

  const context: OperationContext<CollectionSlug> = {
    params: {
      id,
      versionId: args.versionId,
      draft,
      locale
    },
    isSystemOperation,
    isFallbackLocale
  };

  return runUpdate<CollectionSlug, T, BuiltCollection>({
    data: args.data,
    config: ctx.config,
    event,
    context,
    locale,
    where: 'updateById',

    write: ({ data, config, context }) =>
      rime.adapter.prototype(config.slug).update({
        id,
        versionId: context.contentOwnerId!,
        data,
        locale,
        versionOperation: context.versionOperation!
      }),

    reread: ({ written, config, context }) =>
      rime.collection(config.slug).findById({
        id: written.id,
        locale,
        versionId: context.params.versionId
      }) as Promise<T>
  });
};
