import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import { runBeforeOperation, runDocHooks } from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/types/doc.js';
import type { RequestEvent } from '@sveltejs/kit';

type DeleteArgs = {
  id: string;
  config: BuiltCollection;
  event: RequestEvent & { locals: App.Locals };
  isSystemOperation?: boolean;
};

export const deleteById = async <T extends GenericDoc>(args: DeleteArgs): Promise<string> => {
  const { event, id, config, isSystemOperation } = args;
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

  const document = (await rime.adapter.collection.findById({
    slug: config.slug,
    id,
    draft: true
  })) as T;

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

  await rime.adapter.collection.deleteById({ slug: config.slug, id });

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

  return args.id;
};
