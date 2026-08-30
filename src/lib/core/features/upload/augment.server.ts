import type { Collection } from '$lib/core/factory/config/types.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { withDirectoriesSuffix } from '$lib/core/naming.js';
import { augmentUpload, type WithNormalizedUpload } from './augment.js';

/**
 * Override _path field to add foreign key constraints
 * @TODO why exactly
 */
export const augmentUploadServer = <T extends Collection<any>>(
  config: T
): WithNormalizedUpload<T> => {
  const collection = augmentUpload(config);
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
