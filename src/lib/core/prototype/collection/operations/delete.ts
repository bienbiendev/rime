import type { BuiltCollection } from '#lib/core/config/types.js';
import { RimeError } from '#lib/core/errors/index.js';
import { assertReadableQuery } from '#lib/core/pipeline/query.js';
import { runBeforeOperation } from '#lib/core/pipeline/run.server.js';
import type { OperationQuery } from '#lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '#lib/core/prototype/define.js';
import type { CollectionSlug } from '#lib/core/prototype/types.js';
import { trycatch } from '#lib/util/function.js';

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

  // The ids a delete answers tell what its filter matched, as a list read does.
  if (!isSystemOperation) {
    assertReadableQuery({ config, event, query, sort });
  }

  const documentsToDelete = await rime.adapter.collection(config.slug).findMany({
    query,
    limit,
    offset,
    sort,
    select: ['id'],
    locale
    // No `content`: see deleteById.
  });

  // Each row is deleted as this operation was asked: a system delete stays a system delete,
  // through to each row's access check and hooks.
  const collection = isSystemOperation
    ? rime.collection(config.slug).system()
    : rime.collection(config.slug);

  // One after the other: rows sharing an uploaded file each check whether another still uses it,
  // and the last one deleted is the one that finds none and removes the file. A row the caller may
  // not delete stays and is left out of the answer; any other error throws.
  const ids: string[] = [];
  for (const { id } of documentsToDelete) {
    const [error] = await trycatch(() => collection.deleteById({ id }));
    if (!error) {
      ids.push(id);
    } else if (!(error instanceof RimeError && error.code === RimeError.UNAUTHORIZED)) {
      throw error;
    }
  }

  return ids;
};
