import type { BuiltCollection } from '#lib/core/config/types.js';
import { assertReadableQuery } from '#lib/core/pipeline/query.js';
import { runBeforeOperation } from '#lib/core/pipeline/run.server.js';
import type { OperationQuery } from '#lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '#lib/core/prototype/define.js';
import type { CollectionSlug } from '#lib/core/prototype/types.js';

export type CountArgs = {
  query?: OperationQuery;
  locale?: string | undefined;
  /** The newest version of each, whatever its status; the published one otherwise. */
  latest?: boolean;
};

type Args = CountArgs & { ctx: PrototypeApiContext<BuiltCollection> };

/**
 * How many documents `find` lists for the same `query` and `latest`, before paging: the
 * beforeOperation hooks of a read, the readable paths of `query`, then one count. No beforeRead
 * hook runs, so a document such a hook leaves out of `find` still counts.
 */
export const count = async (args: Args): Promise<number> => {
  const { ctx, query, locale, latest } = args;
  const { config, event, isSystemOperation } = ctx;

  await runBeforeOperation<CollectionSlug>({
    config,
    event,
    operation: 'read',
    context: { isSystemOperation, params: { query, locale, latest } }
  });

  if (!isSystemOperation) {
    assertReadableQuery({ config, event, query });
  }

  return event.locals.rime.adapter
    .collection(config.slug)
    .count({ query, locale, content: ctx.versionQuery({ latest }) });
};
