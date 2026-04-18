import type { BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { OperationContext } from '$lib/core/operations/hooks/index.server.js';
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

  for (const hook of config.$hooks?.beforeOperation || []) {
    const result = await hook({
      config,
      operation: 'delete',
      event,
      context
    });
    context = result.context;
  }

  const document = (await rime.adapter.collection.findById({
    slug: config.slug,
    id,
    draft: true
  })) as T;
  if (!document) {
    throw new RimeError(RimeError.NOT_FOUND);
  }

  for (const hook of config.$hooks?.beforeDelete || []) {
    const result = await hook({
      doc: document,
      config,
      operation: 'delete',
      event,
      context
    });
    context = result.context;
  }

  await rime.adapter.collection.deleteById({ slug: config.slug, id });

  for (const hook of config.$hooks?.afterDelete || []) {
    const result = await hook({
      doc: document,
      config,
      operation: 'delete',
      event,
      context
    });
    context = result.context;
  }

  return args.id;
};
