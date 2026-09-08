import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';

/**
 * Loads the document an update is about to change.
 *
 * Every prototype has one, so this is core's; *which row* it is, is not. That used to be decided
 * here, with
 *
 *     draft: VersionOperations.shouldRetrieveDraft(context.versionOperation)
 *
 * — a core step importing a feature's enum and its helper to apply a feature's rule. The rule
 * underneath is real: on an update `?draft=true` means "branch a new draft *from the published
 * version*", the opposite of what `draft` means on a read. It is stated once now, by the feature
 * that owns it, and reached through `intent: 'original'` (see `ReadIntent`).
 *
 * What is left here is the part that is genuinely core's: load the original, of whichever
 * prototype this is.
 */
export const getOriginalDocument = Hooks.beforeUpdate({
  name: 'getOriginalDocument',
  requires: [],
  provides: ['original-doc'],
  run: async (args) => {
    const { event, config, context } = args;
    const { rime } = event.locals;

    let original;

    switch (config.type) {
      //
      case 'collection':
        if (!context.params.id)
          throw new RimeError(RimeError.OPERATION_ERROR, 'missing id @getOriginalDocument');

        original = await rime.collection(config.slug).findById({
          locale: context.params.locale,
          id: context.params.id,
          versionId: context.params.versionId,
          draft: context.params.draft,
          intent: 'original'
        });

        break;

      case 'area':
        original = await rime.area(config.slug).find({
          locale: context.params.locale,
          versionId: context.params.versionId,
          draft: context.params.draft,
          intent: 'original'
        });
        break;
    }

    return {
      ...args,
      context: {
        ...args.context,
        originalDoc: original
      }
    };
  }
});
