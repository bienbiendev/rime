import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { logger } from '$lib/core/logger.server.js';
import { runBeforeOperation, runDocHooks } from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { CollectionSlug, GenericDoc, RawDoc } from '$lib/core/types/doc.js';
import type { OperationQuery } from '$lib/core/types/index.js';
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

  const documentsRaw = await rime.adapter.collection.find({
    slug: config.slug,
    query,
    sort,
    limit,
    offset,
    locale,
    select,
    draft
  });

  const hasSelect = !!select && Array.isArray(select) && !!select.length;

  async function processDocument(documentRaw: RawDoc) {
    // Deliberately outside the try below: a transform failure is not a per-document skip, it
    // rejects the whole find, exactly as before this was extracted.
    const document = await event.locals.rime.adapter.transform.doc({
      doc: documentRaw,
      slug: config.slug,
      locale,
      event,
      depth,
      withBlank: !hasSelect
    });

    try {
      const result = await runDocHooks<CollectionSlug, T>({
        hooks: config.$hooks?.beforeRead,
        doc: document as T,
        config,
        event,
        operation: 'read',
        context
      });
      context = result.context;
      return result.doc;
    } catch (error: any) {
      // If a beforeRead hook throws, skip this document and carry on with the next one
      logger.error(error.message, error);
      return null; // Indicate that this document should be filtered out
    }
  }

  const documents = await Promise.all(documentsRaw.map((doc) => processDocument(doc)));

  return documents.filter((d) => !!d) as T[];
};
