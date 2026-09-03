import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { runBeforeOperation } from '$lib/core/operations/run.server.js';
import type { OperationQuery } from '$lib/core/operations/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';

export type DeleteArgs = {
  query?: OperationQuery;
  locale?: string | undefined;
  sort?: string;
  limit?: number;
  offset?: number;
};

type Args = DeleteArgs & { ctx: PrototypeApiContext<BuiltCollection> };

export const deleteDocs = async (args: Args): Promise<string[]> => {
  const { ctx, locale, limit, offset, sort, query } = args;
  const { config, event, isSystemOperation } = ctx;
  const { rime } = event.locals;

  await runBeforeOperation<CollectionSlug>({
    config,
    event,
    operation: 'delete',
    context: {
      params: { locale, limit, offset, sort, query },
      isSystemOperation
    }
  });

  const documentsToDelete = await rime.adapter.prototype(config.slug).findMany({
    query,
    limit,
    offset,
    sort,
    select: ['id'],
    locale,
    draft: true
  });

  const promisesDelete = documentsToDelete.map(({ id }) => {
    return rime.collection(config.slug).deleteById({ id });
  });

  const ids = await Promise.all(promisesDelete);

  return ids;
};
