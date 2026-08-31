import type { BuiltArea } from '$lib/core/factory/config/types.js';
import { readDocument, runBeforeOperation } from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { AreaSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';

type FindArgs = {
  locale?: string | undefined;
  config: BuiltArea;
  event: RequestEvent;
  depth?: number;
  select?: string[];
  versionId?: string;
  draft?: boolean;
  isSystemOperation?: boolean;
};

export const find = async <T extends GenericDoc>(args: FindArgs): Promise<T> => {
  const { config, event, locale, depth, select, versionId, draft, isSystemOperation } = args;

  let context: OperationContext<AreaSlug> = {
    params: {
      locale,
      depth,
      select,
      versionId,
      draft
    },
    isSystemOperation
  };

  context = await runBeforeOperation<AreaSlug>({
    config,
    event,
    operation: 'read',
    context
  });

  const documentRaw = await event.locals.rime.adapter.area.get({
    slug: config.slug,
    locale,
    select,
    versionId,
    draft
  });

  const { doc } = await readDocument<AreaSlug, T>({
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
