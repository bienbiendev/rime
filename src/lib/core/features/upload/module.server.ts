import type { Collection } from '$lib/core/config/types.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { withDirectoriesSuffix } from '$lib/core/features/upload/naming.js';
import { augmentUpload as augmentUploadBase } from './module.js';
import type { WithNormalizedUpload } from './types.js';

/**
 * The upload feature's server half.
 *
 * Same export name as `module.ts` for the augment, because `$rime/modules` picks the file, not the
 * name — the `…Server` suffix this replaces was doing the resolver's job by hand. `uploadHooks`
 * has no client half at all, so the resolver stubs it to `undefined` there.
 */

/**
 * The client augment, plus the one thing a client config must not carry: `_path` points at the
 * collection's directories table, and that foreign key is what makes the schema's cascade work.
 * Get this half onto the wrong build and the FK silently vanishes — which is why the golden
 * schema diff is the check that matters for this feature.
 */
export const augmentUpload = <T extends Collection<any>>(config: T): WithNormalizedUpload<T> => {
  const collection = augmentUploadBase(config);

  (collection.fields || []).forEach((field) => {
    if (field instanceof FormFieldBuilder && field.name === '_path') {
      field.$references(withDirectoriesSuffix(config.slug), {
        onDelete: 'cascade',
        onUpdate: 'cascade'
      });
    }
  });

  return collection;
};
