import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { readDocument, runBeforeOperation } from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';

type Args = {
  id: string;
  versionId?: string;
  locale?: string | undefined;
  config: BuiltCollection;
  event: RequestEvent;
  depth?: number;
  select?: string[];
  draft?: boolean;
  isSystemOperation?: boolean;
};

export const findById = async <T extends GenericDoc>(args: Args) => {
  const { config, event, id, versionId, locale, depth, select, draft, isSystemOperation } = args;
  const { rime } = event.locals;

  let context: OperationContext<CollectionSlug> = {
    params: {
      id,
      versionId,
      locale,
      depth,
      draft,
      select
    },
    isSystemOperation
  };

  context = await runBeforeOperation<CollectionSlug>({
    config,
    event,
    operation: 'read',
    context
  });

  const documentRaw = await rime.adapter.collection.findById({
    slug: config.slug,
    id,
    versionId,
    locale,
    select,
    draft
  });

  const { doc } = await readDocument<CollectionSlug, T>({
    raw: documentRaw,
    config,
    event,
    context,
    locale,
    depth,
    select
  });

  return doc;
};
