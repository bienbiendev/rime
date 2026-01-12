import { date } from '$lib/fields/date/index.js';
import { text } from '$lib/fields/text/index.js';
import type { Collection } from '../../../types.js';

type Input = { fields?: Collection<any>['fields'] };

/**
 * Add updatedAt createdAt editedBy fields
 */
export const augmentMetas = <T extends Input>(config: T): T => {
	const fields = [...(config.fields || [])];
	fields.push(
		//
		text('editedBy').hidden(),
		date('createdAt').hidden(),
		date('updatedAt').hidden()
	);
	return { ...config, fields };
};
