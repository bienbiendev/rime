import { readableReferences } from '$lib/core/fields/util.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { logger } from '$lib/core/logger.server.js';
import { readDocuments, runBeforeOperation } from '$lib/core/pipeline/run.server.js';
import type { OperationContext, OperationQuery } from '$lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';

export type FindArgs = {
  query?: OperationQuery;
  locale?: string | undefined;
  sort?: string;
  depth?: number;
  limit?: number;
  offset?: number;
  select?: string[];
  /** The newest version of each, whatever its status; the published one otherwise. */
  latest?: boolean;
  /** See the collection's findById. */
  localeFallback?: boolean;
};

type Args = FindArgs & { ctx: PrototypeApiContext<BuiltCollection> };

export const find = async <T extends GenericDoc>(args: Args): Promise<T[]> => {
  //
  const {
    ctx,
    locale,
    sort,
    limit,
    offset,
    depth,
    query,
    latest,
    select = [],
    localeFallback
  } = args;
  const { config, event, isSystemOperation } = ctx;
  const { rime } = event.locals;

  let context: OperationContext<CollectionSlug> = {
    isSystemOperation,
    params: {
      query,
      sort,
      limit,
      offset,
      locale,
      select,
      latest,
      depth
    }
  };

  context = await runBeforeOperation<CollectionSlug>({
    config,
    event,
    operation: 'read',
    context
  });

  const documentsRaw = await rime.adapter.collection(config.slug).findMany({
    query,
    sort,
    limit,
    offset,
    locale,
    localeFallback,
    select,
    resolve: isSystemOperation ? undefined : readableReferences(config.fields, event.locals.user),
    // Which content row each document shows. `and`ed with `query` by the adapter, rather than
    // spliced into it — see the collection's findById for where the answer comes from.
    content: ctx.versionQuery({ latest })
  });

  const results = await readDocuments<CollectionSlug, T>({
    raws: documentsRaw,
    config,
    event,
    context,
    locale,
    localeFallback,
    depth,
    select
  });

  // A row rime cannot turn into a document, or that a beforeRead hook rejects, is skipped: one bad
  // row does not take the whole list down.
  return results.flatMap((result) => {
    if (result.status === 'fulfilled') return [result.value.doc];
    logger.error(result.reason.message, result.reason);
    return [];
  });
};
