import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';

/**
 * Loads the document an update is about to change: the row `versionId` names, else the newest
 * one with `latest`, else the published one — selected exactly as a read selects, by
 * `versionsReadQuery`.
 *
 * Every prototype has one, so this step is core's. A document with no published version answers
 * `not_found` to an update that selects the published one; `latest` is how to write it.
 *
 * Read as rime: the update changes the document as it is, not what the caller may read of it.
 * The caller's right to update was checked by `authorize`.
 */
export const getOriginalDocument = Hooks.beforeUpdate(async function getOriginalDocument(args) {
  const { event, config, context } = args;
  const { rime } = event.locals;
  const { id, locale, versionId, latest } = context.params;

  let original;

  switch (config.type) {
    case 'collection':
      if (!id) throw new RimeError(RimeError.OPERATION_ERROR, 'missing id @getOriginalDocument');

      original = await rime
        .collection(config.slug)
        .system()
        .findById({ locale, id, versionId, latest });
      break;

    case 'area':
      original = await rime.area(config.slug).system().find({ locale, versionId, latest });
      break;
  }

  return {
    ...args,
    context: {
      ...args.context,
      originalDoc: original
    }
  };
});
