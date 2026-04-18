import type { BuiltArea } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { OperationContext } from '$lib/core/operations/hooks/index.server.js';
import type { AreaSlug, GenericDoc } from '$lib/core/types/doc.js';
import type { DeepPartial } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { saveBlocks } from '../../operations/blocks/index.server.js';
import { saveRelations } from '../../operations/relations/index.server.js';
import { saveTreeBlocks } from '../../operations/tree/index.server.js';

type UpdateArgs<T> = {
  data: DeepPartial<T>;
  locale?: string | undefined;
  config: BuiltArea;
  event: RequestEvent;
  versionId?: string;
  draft?: boolean;
  isSystemOperation?: boolean;
};

export const update = async <T extends GenericDoc = GenericDoc>(args: UpdateArgs<T>) => {
  //
  const { config, event, locale, draft, isSystemOperation, versionId } = args;
  const { rime } = event.locals;

  let data = args.data;

  let context: OperationContext<AreaSlug> = {
    params: {
      locale,
      versionId,
      draft
    },
    isSystemOperation
  };

  for (const hook of config.$hooks?.beforeOperation || []) {
    const result = await hook({
      config,
      operation: 'update',
      event,
      context
    });
    context = result.context;
  }

  for (const hook of config.$hooks?.beforeUpdate || []) {
    const result = await hook({
      data,
      config,
      operation: 'update',
      event,
      context
    });
    context = result.context;
    data = result.data as Partial<T>;
  }

  if (!context.configMap)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing configMap @update');
  if (!context.originalConfigMap)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalConfigMap @update');
  if (!context.originalDoc)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @update');
  if (!context.versionOperation)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing versionOperation @update');
  if (!context.params.versionId)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing versionId @update');

  const incomingPaths = Object.keys(context.configMap);

  await rime.adapter.area.update({
    slug: config.slug,
    data,
    locale,
    versionId: context.params.versionId,
    versionOperation: context.versionOperation
  });

  const blocksDiff = await saveBlocks({
    context,
    ownerId: context.params.versionId,
    data,
    incomingPaths,
    adapter: rime.adapter,
    config
  });

  const treeDiff = await saveTreeBlocks({
    context,
    ownerId: context.params.versionId,
    data,
    incomingPaths,
    adapter: rime.adapter,
    config
  });

  await saveRelations({
    ownerId: context.params.versionId,
    configMap: context.configMap,
    data,
    incomingPaths,
    adapter: rime.adapter,
    config,
    locale,
    blocksDiff,
    treeDiff
  });

  // Get the updated area with the correct version ID
  const document = await rime.area(config.slug).find({
    locale,
    versionId: versionId,
    draft: true
  });

  for (const hook of config.$hooks?.afterUpdate || []) {
    const result = await hook({
      doc: document,
      config,
      operation: 'update',
      event,
      context,
      data
    });
    context = result.context;
  }

  return document as unknown as T;
};
