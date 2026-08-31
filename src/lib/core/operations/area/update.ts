import type { BuiltArea } from '$lib/core/factory/config/types.js';
import { runUpdate } from '$lib/core/operations/run.server.js';
import type { OperationContext } from '$lib/core/operations/types.js';
import type { AreaSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { DeepPartial } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

type UpdateArgs<T> = {
  data: DeepPartial<T>;
  locale?: string | undefined;
  config: BuiltArea;
  event: RequestEvent;
  versionId?: string;
  draft?: boolean;
  isSystemOperation?: boolean;
};

/**
 * Updates an area's single document.
 *
 * The pipeline itself lives in operations/run.server.ts — shared with a collection's
 * updateById. Only the two prototype-specific pieces are here: which adapter method writes the
 * root row, and how the saved document is read back.
 */
export const update = async <T extends GenericDoc = GenericDoc>(args: UpdateArgs<T>) => {
  const { config, event, locale, draft, isSystemOperation, versionId } = args;
  const { rime } = event.locals;

  const context: OperationContext<AreaSlug> = {
    params: {
      locale,
      versionId,
      draft
    },
    isSystemOperation
  };

  return runUpdate<AreaSlug, T, BuiltArea>({
    data: args.data,
    config,
    event,
    context,
    locale,
    where: 'update',

    write: ({ data, config, context }) =>
      rime.adapter.area.update({
        slug: config.slug,
        data,
        locale,
        versionId: context.params.versionId!,
        versionOperation: context.versionOperation!
      }),

    // Deliberately the versionId this call was made with, not the one the hooks resolved onto
    // the context, and always draft:true — preserved from the pre-refactor implementation.
    reread: ({ config }) =>
      rime.area(config.slug).find({
        locale,
        versionId,
        draft: true
      }) as unknown as Promise<T>
  });
};
