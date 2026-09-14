import type { BuiltCollection } from '$lib/core/config/types.js';
import { logger } from '$lib/core/logger.server.js';
import { readDocument, runBeforeOperation } from '$lib/core/pipeline/run.server.js';
import type { OperationContext, OperationQuery } from '$lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { CollectionSlug, GenericDoc, RawDoc } from '$lib/core/prototype/types.js';

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
    // Which content row each document shows. `and`ed with `query` by the adapter, rather than
    // spliced into it — see the collection's findById for where the answer comes from.
    content: ctx.versionQuery({ latest })
  });

  async function processDocument(documentRaw: RawDoc) {
    try {
      const result = await readDocument<CollectionSlug, T>({
        raw: documentRaw,
        config,
        event,
        context,
        locale,
        localeFallback,
        depth,
        select
      });
      context = result.context;
      return result.doc;
    } catch (error: any) {
      // Skip this document and carry on with the next one. The transform is inside the try
      // alongside the hooks now: a row rime cannot turn into a document is the same kind of
      // per-row problem as a beforeRead hook rejecting one, and taking the whole query down
      // for it made a single bad row look like an empty collection.
      logger.error(error.message, error);
      return null;
    }
  }

  const documents = await Promise.all(documentsRaw.map((doc) => processDocument(doc)));

  return documents.filter((d) => !!d) as T[];
};
