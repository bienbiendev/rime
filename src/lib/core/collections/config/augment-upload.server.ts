import type { Collection } from '$lib/core/config/types.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { withDirectoriesSuffix } from '$lib/core/naming.js';
import { augmentUpload, type WithNormalizedUpload } from './augment-upload.js';

/**
 * Override _path field to add foreign key constraints
 */
export const augmentUploadServer = <T extends Collection<any>>(
	config: T
): WithNormalizedUpload<T> => {
	const collection = augmentUpload(config);
	(collection.fields || []).forEach((field) => {
		if (field instanceof FormFieldBuilder && field.name === '_path') {
			field = field.$generateSchema(
				() =>
					`_path: text('_path').references(() => ${withDirectoriesSuffix(config.slug)}.id, {onDelete: 'cascade', onUpdate: 'cascade'})`
			);
		}
	});
	return collection;
};
