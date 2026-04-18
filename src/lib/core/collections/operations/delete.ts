import type { BuiltCollection } from '$lib/core/config/types.js';
import type { OperationContext } from '$lib/core/operations/hooks/index.server.js';
import type { OperationQuery } from '$lib/core/types/index.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { CollectionSlug } from '../../../types.js';

type DeleteArgs = {
  query?: OperationQuery;
  locale?: string | undefined;
  config: BuiltCollection;
  event: RequestEvent & { locals: App.Locals };
  sort?: string;
  limit?: number;
  offset?: number;
  isSystemOperation?: boolean;
};

export const deleteDocs = async (args: DeleteArgs): Promise<string[]> => {
  const { config, event, locale, limit, offset, sort, query, isSystemOperation } = args;
  const { rime } = event.locals;

  let context: OperationContext<CollectionSlug> = {
    params: { locale, limit, offset, sort, query },
    isSystemOperation
  };

  for (const hook of config.$hooks?.beforeOperation || []) {
    const result = await hook({
      config,
      operation: 'delete',
      event,
      context
    });
    context = result.context;
  }

  const documentsToDelete = await rime.adapter.collection.find({
    slug: config.slug,
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
