import type { BuiltCollection } from '$lib/core/config/types.js';
import type { OperationContext } from '$lib/core/operations/hooks/index.server.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/types/doc.js';
import type { RegisterCollection } from '$lib/index.js';
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

  for (const hook of config.$hooks?.beforeOperation || []) {
    const result = await hook({
      config,
      operation: 'read',
      event,
      context
    });
    context = result.context;
  }

  const documentRaw = await rime.adapter.collection.findById({
    slug: config.slug,
    id,
    versionId,
    locale,
    select,
    draft
  });

  let document = await event.locals.rime.adapter.transform.doc({
    doc: documentRaw,
    slug: config.slug,
    locale,
    event,
    depth
  });

  for (const hook of config.$hooks?.beforeRead || []) {
    const result = await hook({
      doc: document as RegisterCollection[CollectionSlug],
      config,
      operation: 'read',
      event,
      context
    });
    context = result.context;
    document = result.doc as T;
  }

  return document as T;
};
