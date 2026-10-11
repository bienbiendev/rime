import { readableReferences } from '#lib/core/fields/util.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import { logger } from '#lib/core/logger.server.js';
import { readDocuments, runBeforeOperation } from '#lib/core/pipeline/run.server.js';
import type { OperationContext } from '#lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '#lib/core/prototype/define.js';
import type { CollectionSlug, GenericDoc } from '#lib/core/prototype/types.js';
import { trycatch } from '#lib/util/function.js';

export type FindByIdsArgs = {
  ids: string[];
  locale?: string | undefined;
  depth?: number;
  /** See the collection's findById. */
  localeFallback?: boolean;
  /** The fields to read, as find's `select`. All of them when absent. */
  select?: string[];
};

type Args = FindByIdsArgs & { ctx: PrototypeApiContext<BuiltCollection> };

/**
 * The published documents with these ids, in one read. A missing id, or one this reader is refused,
 * is left out.
 */
export const findByIds = async <T extends GenericDoc>(args: Args): Promise<T[]> => {
  const { ctx, ids, locale, depth, localeFallback, select = [] } = args;
  const { config, event, isSystemOperation } = ctx;

  // The beforeOperation chain findById runs, once per id, each run starting from the context the
  // one before returned: a read rule that looks at `id` answers for each document as it would one
  // at a time. A refusal leaves the id out; anything else throws.
  let context: OperationContext<CollectionSlug> = { isSystemOperation, params: { locale, depth } };
  const readable: string[] = [];
  for (const id of ids) {
    const [error, result] = await trycatch(() =>
      runBeforeOperation<CollectionSlug>({
        config,
        event,
        operation: 'read',
        context: { ...context, params: { ...context.params, id } }
      })
    );
    if (!error) {
      readable.push(id);
      context = result;
    } else if (!(error instanceof RimeError && error.code === RimeError.UNAUTHORIZED)) {
      throw error;
    }
  }

  if (!readable.length) return [];

  const documentsRaw = await event.locals.rime.adapter.collection(config.slug).findMany({
    // `id` names the document on a versioned collection too: the adapter reads it as `ownerId`.
    query: { where: { id: { in_array: readable } } },
    locale,
    localeFallback,
    select,
    resolve: isSystemOperation ? undefined : readableReferences(config.fields, event.locals.user),
    // The published row, as findById reads with no `latest` and no `versionId`.
    content: ctx.versionQuery({})
  });

  const results = await readDocuments<CollectionSlug, T>({
    raws: documentsRaw,
    config,
    event,
    context: { ...context, params: { locale, depth, select } },
    locale,
    localeFallback,
    depth,
    select
  });

  return results.flatMap((result) => {
    if (result.status === 'fulfilled') return [result.value.doc];
    logger.error(result.reason.message, result.reason);
    return [];
  });
};
