import { RimeError } from '$lib/core/errors/index.js';
import type { BuiltArea } from '$lib/core/config/types.js';
import { readDocument, runBeforeOperation } from '$lib/core/pipeline/run.server.js';
import type { OperationContext } from '$lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { AreaSlug, GenericDoc } from '$lib/core/prototype/types.js';

export type FindArgs = {
  locale?: string | undefined;
  depth?: number;
  select?: string[];
  versionId?: string;
  draft?: boolean;
};

type Args = FindArgs & { ctx: PrototypeApiContext<BuiltArea> };

export const find = async <T extends GenericDoc>(args: Args): Promise<T> => {
  const { ctx, locale, depth, select, versionId, draft } = args;
  const { config, event, isSystemOperation } = ctx;

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

  // No id: a singleton has exactly one row, and the handle knows it.
  const documentRaw = await event.locals.rime.adapter.prototype(config.slug).find({
    locale,
    select,
    versionId,
    draft
  });

  if (!documentRaw) throw new RimeError(RimeError.NOT_FOUND);

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
