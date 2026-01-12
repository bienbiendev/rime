import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { Collection } from '../../../types.js';
import { augmentAuth, type WithNormalizedAuth } from './augment-auth.js';

export const augmentAuthServer = <T extends Collection<any>>(config: T): WithNormalizedAuth<T> => {
	const collection = augmentAuth(config);

	const IS_API_AUTH = collection.auth?.type === 'apiKey';

	/**
	 * For APIKeys auth collections,
	 * register the staff ownerId as a reference
	 * this way APIKeys are always correlated to a staff member
	 */
	function addSchemaStaffReferenceForAPIKeys() {
		(collection.fields || []).forEach((field) => {
			if (field instanceof FormFieldBuilder && field.name === 'ownerId') {
				field = field.$generateSchema(
					() => `ownerId: text('onwer_id').references(() => staff.id, {onDelete: 'cascade'})`
				);
			}
		});
		return collection;
	}

	if (IS_API_AUTH) {
		addSchemaStaffReferenceForAPIKeys();
	}

	return collection;
};
