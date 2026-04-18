import type { BuiltArea } from '$lib/core/config/types.js';
import type { OperationContext } from '$lib/core/operations/hooks/index.server.js';
import type { AreaSlug, GenericDoc } from '$lib/core/types/doc.js';
import { type RegisterArea } from '$lib/index.js';
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
  //
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

  for (const hook of config.$hooks?.beforeOperation || []) {
    const result = await hook({
      config,
      operation: 'read',
      event,
      context
    });
    context = result.context;
  }

  const documentRaw = await event.locals.rime.adapter.area.get({
    slug: config.slug,
    locale,
    select,
    versionId,
    draft
  });

  const hasSelect = select && Array.isArray(select) && !!select.length;

  let document = await event.locals.rime.adapter.transform.doc({
    doc: documentRaw,
    slug: config.slug,
    locale,
    event,
    depth,
    withBlank: !hasSelect
  });

  for (const hook of config.$hooks?.beforeRead || []) {
    const result = await hook({
      doc: document as unknown as RegisterArea[AreaSlug],
      config,
      operation: 'read',
      event,
      context
    });
    context = result.context;
    document = result.doc as unknown as T;
  }

  return document as T;
};
