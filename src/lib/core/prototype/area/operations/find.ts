import { RimeError } from '#lib/core/errors/index.js';
import type { BuiltArea } from '#lib/core/config/types.js';
import { readDocument, runBeforeOperation } from '#lib/core/pipeline/run.server.js';
import type { OperationContext } from '#lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '#lib/core/prototype/define.js';
import type { AreaSlug, GenericDoc } from '#lib/core/prototype/types.js';
import type { ReadArgs } from '#lib/core/prototype/shared/operations/read-args.js';
import { rowQuery } from '#lib/core/prototype/shared/operations/row-query.js';

export type FindArgs = ReadArgs;

type Args = FindArgs & { ctx: PrototypeApiContext<BuiltArea> };

export const find = async <T extends GenericDoc>(args: Args): Promise<T> => {
  const { ctx, locale, depth, select, versionId, latest, localeFallback } = args;
  const { config, event, isSystemOperation } = ctx;

  let context: OperationContext<AreaSlug> = {
    params: {
      locale,
      depth,
      select,
      versionId,
      latest
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
  const documentRaw = await event.locals.rime.adapter.area(config.slug).find(rowQuery(ctx, args));

  if (!documentRaw) throw new RimeError(RimeError.NOT_FOUND);

  const { doc } = await readDocument<AreaSlug, T>({
    raw: documentRaw,
    config,
    event,
    context,
    locale,
    localeFallback,
    depth,
    select
  });

  return doc;
};
