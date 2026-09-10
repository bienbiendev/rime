import { RimeError } from '$lib/core/errors/index.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { readDocument, runBeforeOperation } from '$lib/core/pipeline/run.server.js';
import type { OperationContext, ReadIntent } from '$lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';

export type FindByIdArgs = {
  id: string;
  versionId?: string;
  locale?: string | undefined;
  depth?: number;
  select?: string[];
  draft?: boolean;
  /**
   * Why this read is happening. `'read'` unless the update pipeline is loading what it is about
   * to change, which selects a different row for the same `draft` — see `ReadIntent`.
   *
   * Internal, in the same way `isSystemOperation` is: `getOriginalDocument` is the only caller
   * that passes it. It is here rather than a `content` filter on the args so that resolving one
   * stays behind `ctx.versionQuery` and no caller has to know what a version is.
   */
  intent?: ReadIntent;
};

type Args = FindByIdArgs & { ctx: PrototypeApiContext<BuiltCollection> };

export const findById = async <T extends GenericDoc>(args: Args) => {
  const { ctx, id, versionId, locale, depth, select, draft, intent } = args;
  const { config, event, isSystemOperation } = ctx;
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

  const documentRaw = await rime.adapter.collection(config.slug).find({
    id,
    locale,
    select,
    // `draft` and `versionId` are request parameters; which row they name is the feature's answer.
    content: ctx.versionQuery({ draft, versionId }, intent)
  });

  // The adapter reports "nothing matched" and leaves the meaning to the caller, so an HTTP-shaped
  // decision like this one stays out of the database layer.
  if (!documentRaw) throw new RimeError(RimeError.NOT_FOUND);

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
