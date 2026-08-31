import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { runUpdate } from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { DeepPartial } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

type Args<T> = {
  id: string;
  versionId?: string;
  draft?: boolean;
  data: DeepPartial<T>;
  locale?: string | undefined;
  config: BuiltCollection;
  event: RequestEvent;
  isFallbackLocale?: string | undefined;
  isSystemOperation?: boolean;
};

/**
 * Updates a document by ID.
 *
 * The pipeline itself lives in operations/run.server.ts — shared with an area's update. Only
 * the two prototype-specific pieces are here: which adapter method writes the root row, and
 * how the saved document is read back.
 */
export const updateById = async <T extends GenericDoc = GenericDoc>(args: Args<T>) => {
  const { event, locale, id, draft, isFallbackLocale = undefined, isSystemOperation } = args;
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
    config: args.config,
    event,
    context,
    locale,
    where: 'updateById',

    write: ({ data, config, context }) =>
      rime.adapter.collection.update({
        id,
        versionId: context.params.versionId!,
        slug: config.slug,
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
