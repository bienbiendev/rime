import { RimeError } from '$lib/core/errors/index.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { readDocument, runBeforeOperation } from '$lib/core/pipeline/run.server.js';
import type { OperationContext } from '$lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';

export type FindByIdArgs = {
  id: string;
  versionId?: string;
  locale?: string | undefined;
  depth?: number;
  select?: string[];
  /** The newest version, whatever its status; the published one otherwise. `PARAMS.LATEST`. */
  latest?: boolean;
  /**
   * Whether a field the locale has not written reads from the other locales. `true` unless said
   * otherwise; `false` is the locale's own rows, which is what a copy onto another row reads.
   */
  localeFallback?: boolean;
};

type Args = FindByIdArgs & { ctx: PrototypeApiContext<BuiltCollection> };

export const findById = async <T extends GenericDoc>(args: Args) => {
  const { ctx, id, versionId, locale, depth, select, latest, localeFallback } = args;
  const { config, event, isSystemOperation } = ctx;
  const { rime } = event.locals;

  let context: OperationContext<CollectionSlug> = {
    params: {
      id,
      versionId,
      locale,
      depth,
      latest,
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
    localeFallback,
    select,
    // `draft` and `versionId` are request parameters; which row they name is the feature's answer.
    content: ctx.versionQuery({ latest, versionId })
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
    localeFallback,
    depth,
    select
  });

  return doc;
};
