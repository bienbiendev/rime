import type { BuiltArea } from '$lib/core/config/types.js';
import { runUpdate } from '$lib/core/pipeline/run.server.js';
import type { OperationContext } from '$lib/core/pipeline/types.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { AreaSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { DeepPartial } from '$lib/util/types.js';

export type UpdateArgs<T> = {
  data: DeepPartial<T>;
  locale?: string | undefined;
  versionId?: string;
  draft?: boolean;
};

type Args<T> = UpdateArgs<T> & { ctx: PrototypeApiContext<BuiltArea> };

/**
 * Updates an area's single document.
 *
 * The pipeline itself lives in operations/run.server.ts — shared with a collection's
 * updateById. Only the two prototype-specific pieces are here: which adapter method writes the
 * root row, and how the saved document is read back.
 */
export const update = async <T extends GenericDoc = GenericDoc>(args: Args<T>) => {
  const { ctx, locale, draft, versionId } = args;
  const { config, event, isSystemOperation } = ctx;
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
      rime.adapter.prototype(config.slug).update({
        data,
        locale,
        versionId: context.contentOwnerId!,
        versionOperation: context.versionOperation!
      }),

    // The versionId this call was made with — `context.params.versionId` is now the same thing,
    // since the hooks answer "which row holds the content" on `context.contentOwnerId` instead of
    // overwriting the caller's parameter. Always draft:true.
    reread: ({ config }) =>
      rime.area(config.slug).find({
        locale,
        versionId,
        draft: true
      }) as unknown as Promise<T>
  });
};
