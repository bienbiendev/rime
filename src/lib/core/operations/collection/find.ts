import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { logger } from '$lib/core/logger.server.js';
import { readDocument, runBeforeOperation } from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { CollectionSlug, GenericDoc, RawDoc } from '$lib/core/prototype/types.js';
import type { OperationQuery } from '$lib/core/operations/types.js';
import type { RequestEvent } from '@sveltejs/kit';

type FindArgs = {
  query?: OperationQuery;
  locale?: string | undefined;
  config: BuiltCollection;
  event: RequestEvent & { locals: App.Locals };
  sort?: string;
  depth?: number;
  limit?: number;
  offset?: number;
  select?: string[];
  draft?: boolean;
  isSystemOperation?: boolean;
};

export const find = async <T extends GenericDoc>(args: FindArgs): Promise<T[]> => {
  //
  const {
    config,
    event,
    locale,
    sort,
    limit,
    offset,
    depth,
    query,
    draft,
    select = [],
    isSystemOperation
  } = args;
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
      draft,
      depth
    }
  };

  context = await runBeforeOperation<CollectionSlug>({
    config,
    event,
    operation: 'read',
    context
  });

  const documentsRaw = await rime.adapter.prototype(config.slug).findMany({
    query,
    sort,
    limit,
    offset,
    locale,
    select,
    draft
  });

  async function processDocument(documentRaw: RawDoc) {
    try {
      const result = await readDocument<CollectionSlug, T>({
        raw: documentRaw,
        config,
        event,
        context,
        locale,
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
