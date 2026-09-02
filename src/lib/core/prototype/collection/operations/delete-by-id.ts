import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import { runBeforeOperation, runDocHooks } from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';

export type DeleteByIdArgs = {
  id: string;
};

type Args = DeleteByIdArgs & { ctx: PrototypeApiContext<BuiltCollection> };

export const deleteById = async <T extends GenericDoc>(args: Args): Promise<string> => {
  const { ctx, id } = args;
  const { config, event, isSystemOperation } = ctx;
  const { rime } = event.locals;

  let context: OperationContext<CollectionSlug> = {
    params: { id },
    isSystemOperation
  };

  context = await runBeforeOperation<CollectionSlug>({
    config,
    event,
    operation: 'delete',
    context
  });

  const document = (await rime.adapter.prototype(config.slug).find({ id, draft: true })) as T;

  if (!document) {
    throw new RimeError(RimeError.NOT_FOUND);
  }

  const before = await runDocHooks<CollectionSlug, T>({
    hooks: config.$hooks?.beforeDelete,
    doc: document,
    config,
    event,
    operation: 'delete',
    context
  });
  context = before.context;

  await rime.adapter.prototype(config.slug).delete({ id });

  // Deliberately the pre-hook document, matching the previous implementation: beforeDelete's
  // returned doc was never carried into afterDelete.
  await runDocHooks<CollectionSlug, T>({
    hooks: config.$hooks?.afterDelete,
    doc: document,
    config,
    event,
    operation: 'delete',
    context
  });

  return id;
};
