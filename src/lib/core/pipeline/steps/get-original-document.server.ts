import { VersionOperations } from '$lib/core/features/versions/strategy.js';
import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';

export const getOriginalDocument = Hooks.beforeUpdate({
  name: 'getOriginalDocument',
  requires: ['version-operation'],
  provides: ['original-doc'],
  run: async (args) => {
    const { event, config, context } = args;
    const { rime } = event.locals;

    let original;

    if (!context.versionOperation)
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing versionOperation @getOriginalDocument'
      );

    switch (config.type) {
      //
      case 'collection':
        if (!context.params.id)
          throw new RimeError(RimeError.OPERATION_ERROR, 'missing id @getOriginalDocument');

        original = await rime.collection(config.slug).findById({
          locale: context.params.locale,
          id: context.params.id,
          versionId: context.params.versionId,
          draft: VersionOperations.shouldRetrieveDraft(context.versionOperation)
        });

        break;

      case 'area':
        original = await rime.area(config.slug).find({
          locale: context.params.locale,
          versionId: context.params.versionId,
          draft: VersionOperations.shouldRetrieveDraft(context.versionOperation)
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
